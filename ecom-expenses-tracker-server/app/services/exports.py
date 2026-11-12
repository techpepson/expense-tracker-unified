import calendar
from datetime import datetime
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.report import MonthlyReport

TYPE_LABELS = {"individual": "Individual", "shared_operational": "Shared operational"}
DARK = colors.HexColor("#1F3A5F")
LIGHT = colors.HexColor("#E8EEF5")


def period_label(report: MonthlyReport) -> str:
    return f"{calendar.month_name[report.month]} {report.year}"


def export_filename(report: MonthlyReport, extension: str) -> str:
    return f"ecom-expense-report-{report.year}-{report.month:02d}.{extension}"


def money(value: Decimal) -> str:
    return f"{value:,.2f}"


# ---------------------------------------------------------------- PDF ------


def build_pdf(report: MonthlyReport) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title=f"Monthly Expense Report {period_label(report)}",
        author=report.organisation,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("T", parent=styles["Title"], fontSize=18, textColor=DARK, spaceAfter=2)
    sub_style = ParagraphStyle("S", parent=styles["Normal"], alignment=1, textColor=colors.grey)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=DARK, spaceBefore=12, spaceAfter=4)
    cell = ParagraphStyle("C", parent=styles["Normal"], fontSize=8, leading=10)
    cell_right = ParagraphStyle("CR", parent=cell, alignment=TA_RIGHT)
    head = ParagraphStyle("H", parent=cell, textColor=colors.white, fontName="Helvetica-Bold")
    head_right = ParagraphStyle("HR", parent=head, alignment=TA_RIGHT)

    def table_style(right_cols: list[int]) -> TableStyle:
        cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), DARK),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#C5CCD6")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
        cmds += [("ALIGN", (c, 0), (c, -1), "RIGHT") for c in right_cols]
        return TableStyle(cmds)

    story = [
        Paragraph(escape(report.organisation), title_style),
        Paragraph("Monthly Expense Report", sub_style),
        Paragraph(f"Period: {period_label(report)} ({report.period_start:%d %b %Y} to {report.period_end:%d %b %Y})", sub_style),
        Spacer(1, 8 * mm),
    ]

    summary = Table(
        [
            ["Total expenditure", f"{report.currency} {money(report.total)}"],
            ["Number of expense records", str(report.count)],
        ],
        colWidths=[70 * mm, 60 * mm],
        hAlign="LEFT",
    )
    summary.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#C5CCD6")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(summary)

    # By category
    story.append(Paragraph("Breakdown by category", h2))
    if report.by_category:
        rows = [[Paragraph("Category", head), Paragraph("Records", head_right),
                 Paragraph(f"Total ({report.currency})", head_right), Paragraph("Share", head_right)]]
        for c in report.by_category:
            rows.append([Paragraph(escape(c.category_name), cell), Paragraph(str(c.count), cell_right),
                         Paragraph(money(c.total), cell_right), Paragraph(f"{c.percentage}%", cell_right)])
        t = Table(rows, colWidths=[85 * mm, 25 * mm, 40 * mm, 30 * mm], repeatRows=1)
        t.setStyle(table_style([1, 2, 3]))
        story.append(t)
    else:
        story.append(Paragraph("No expenses recorded for this period.", styles["Normal"]))

    # By type
    story.append(Paragraph("Breakdown by expense type", h2))
    rows = [[Paragraph("Type", head), Paragraph("Records", head_right),
             Paragraph(f"Total ({report.currency})", head_right), Paragraph("Share", head_right)]]
    for tt in report.by_type:
        rows.append([Paragraph(TYPE_LABELS[tt.expense_type.value], cell), Paragraph(str(tt.count), cell_right),
                     Paragraph(money(tt.total), cell_right), Paragraph(f"{tt.percentage}%", cell_right)])
    t = Table(rows, colWidths=[85 * mm, 25 * mm, 40 * mm, 30 * mm], repeatRows=1)
    t.setStyle(table_style([1, 2, 3]))
    story.append(t)

    # Detail
    story.append(Paragraph("Expense details", h2))
    if report.expenses:
        rows = [[Paragraph(h, head) for h in ("Date", "Title", "Category", "Type", "Recorded by")]
                + [Paragraph(f"Amount ({report.currency})", head_right)]]
        for e in report.expenses:
            rows.append([
                Paragraph(f"{e.expense_date:%d %b %Y}", cell),
                Paragraph(escape(e.title), cell),
                Paragraph(escape(e.category.name), cell),
                Paragraph(TYPE_LABELS[e.expense_type.value], cell),
                Paragraph(escape(e.creator.full_name), cell),
                Paragraph(money(e.amount), cell_right),
            ])
        t = Table(rows, colWidths=[22 * mm, 48 * mm, 32 * mm, 24 * mm, 28 * mm, 26 * mm], repeatRows=1)
        t.setStyle(table_style([5]))
        story.append(t)
    else:
        story.append(Paragraph("No expenses recorded for this period.", styles["Normal"]))

    generated = datetime.now().strftime("%d %b %Y %H:%M")

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(15 * mm, 10 * mm, f"{report.organisation} | Generated {generated}")
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


# -------------------------------------------------------------- Excel ------


def build_excel(report: MonthlyReport) -> bytes:
    wb = Workbook()
    bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="1F3A5F")
    head_font = Font(bold=True, color="FFFFFF")
    money_fmt = "#,##0.00"

    # Summary sheet
    ws = wb.active
    ws.title = "Summary"
    ws["A1"] = report.organisation
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = "Monthly Expense Report"
    ws["A3"] = f"Period: {period_label(report)} ({report.period_start:%d %b %Y} to {report.period_end:%d %b %Y})"
    ws["A5"], ws["B5"] = "Total expenditure", float(report.total)
    ws["A6"], ws["B6"] = "Number of expense records", report.count
    ws["A7"], ws["B7"] = "Currency", report.currency
    ws["B5"].number_format = money_fmt
    for r in (5, 6, 7):
        ws[f"A{r}"].font = bold

    def write_block(start_row: int, title: str, headers: list[str], data: list[list]) -> int:
        ws.cell(row=start_row, column=1, value=title).font = Font(bold=True, size=12)
        r = start_row + 1
        for i, h in enumerate(headers, start=1):
            c = ws.cell(row=r, column=i, value=h)
            c.font, c.fill = head_font, head_fill
        for row in data:
            r += 1
            for i, v in enumerate(row, start=1):
                c = ws.cell(row=r, column=i, value=v)
                if i == 3:
                    c.number_format = money_fmt
        return r + 2

    nxt = write_block(
        9, "Breakdown by category", ["Category", "Records", f"Total ({report.currency})", "Share (%)"],
        [[c.category_name, c.count, float(c.total), float(c.percentage)] for c in report.by_category],
    )
    write_block(
        nxt, "Breakdown by expense type", ["Type", "Records", f"Total ({report.currency})", "Share (%)"],
        [[TYPE_LABELS[t.expense_type.value], t.count, float(t.total), float(t.percentage)] for t in report.by_type],
    )
    for col, width in zip("ABCD", (34, 12, 18, 12)):
        ws.column_dimensions[col].width = width

    # Detail sheet
    wd = wb.create_sheet("Expenses")
    headers = ["Date", "Title", "Description", "Category", "Type", "Recorded by", f"Amount ({report.currency})"]
    for i, h in enumerate(headers, start=1):
        c = wd.cell(row=1, column=i, value=h)
        c.font, c.fill = head_font, head_fill
    for r, e in enumerate(report.expenses, start=2):
        wd.cell(row=r, column=1, value=e.expense_date).number_format = "DD MMM YYYY"
        wd.cell(row=r, column=2, value=e.title)
        wd.cell(row=r, column=3, value=e.description or "")
        wd.cell(row=r, column=4, value=e.category.name)
        wd.cell(row=r, column=5, value=TYPE_LABELS[e.expense_type.value])
        wd.cell(row=r, column=6, value=e.creator.full_name)
        wd.cell(row=r, column=7, value=float(e.amount)).number_format = money_fmt
    total_row = len(report.expenses) + 2
    wd.cell(row=total_row, column=6, value="Total").font = bold
    if report.expenses:
        wd.cell(row=total_row, column=7, value=f"=SUM(G2:G{total_row - 1})")
    else:
        wd.cell(row=total_row, column=7, value=0)
    wd.cell(row=total_row, column=7).number_format = money_fmt
    wd.cell(row=total_row, column=7).font = bold
    wd.freeze_panes = "A2"
    for i, width in enumerate((14, 36, 36, 26, 20, 24, 18), start=1):
        wd.column_dimensions[get_column_letter(i)].width = width
        if i == 7:
            wd.column_dimensions[get_column_letter(i)].alignment = Alignment(horizontal="right")

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
