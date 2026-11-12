import io
from decimal import Decimal

from openpyxl import load_workbook
from pypdf import PdfReader

from app.models import Expense, ExpenseType


def seed_expenses(db, user, category, other_category):
    rows = [
        ("Oct power", "100.10", "2026-10-01", ExpenseType.SHARED_OPERATIONAL, category),
        ("Oct power 2", "200.20", "2026-10-31", ExpenseType.SHARED_OPERATIONAL, category),
        ("Oct fuel", "50.05", "2026-10-15", ExpenseType.INDIVIDUAL, other_category),
        ("Sep edge", "999.99", "2026-09-30", ExpenseType.INDIVIDUAL, other_category),
        ("Nov edge", "888.88", "2026-11-01", ExpenseType.INDIVIDUAL, other_category),
    ]
    from datetime import date
    for title, amount, d, t, c in rows:
        db.add(Expense(title=title, amount=Decimal(amount), expense_date=date.fromisoformat(d),
                       expense_type=t, category_id=c.id, created_by=user.id))
    db.commit()


def test_monthly_totals_match_records_and_respect_boundaries(client, db, alice, category, fuel, login):
    seed_expenses(db, alice, category, fuel)
    r = client.get("/api/reports/monthly?year=2026&month=10", headers=login("alice@example.com"))
    assert r.status_code == 200
    rep = r.json()

    assert rep["count"] == 3
    assert Decimal(rep["total"]) == Decimal("350.35")                  # exact: no float drift
    assert rep["period_start"] == "2026-10-01" and rep["period_end"] == "2026-10-31"
    assert rep["currency"] == "GHS"

    cats = {c["category_name"]: c for c in rep["by_category"]}
    assert Decimal(cats["Electricity"]["total"]) == Decimal("300.30") and cats["Electricity"]["count"] == 2
    assert Decimal(cats["Fuel"]["total"]) == Decimal("50.05")
    assert rep["by_category"][0]["category_name"] == "Electricity"     # biggest first

    types = {t["expense_type"]: t for t in rep["by_type"]}
    assert Decimal(types["shared_operational"]["total"]) == Decimal("300.30")
    assert Decimal(types["individual"]["total"]) == Decimal("50.05")

    # every breakdown adds up to the grand total, and to the detail rows
    assert sum(Decimal(c["total"]) for c in rep["by_category"]) == Decimal(rep["total"])
    assert sum(Decimal(t["total"]) for t in rep["by_type"]) == Decimal(rep["total"])
    assert sum(Decimal(e["amount"]) for e in rep["expenses"]) == Decimal(rep["total"])
    assert [e["title"] for e in rep["expenses"]] == ["Oct power", "Oct fuel", "Oct power 2"]  # by date


def test_empty_month(client, alice, login):
    rep = client.get("/api/reports/monthly?year=2026&month=2", headers=login("alice@example.com")).json()
    assert rep["count"] == 0 and Decimal(rep["total"]) == 0 and rep["by_category"] == []
    assert len(rep["by_type"]) == 2


def test_report_param_validation(client, alice, login):
    h = login("alice@example.com")
    assert client.get("/api/reports/monthly", headers=h).status_code == 422
    assert client.get("/api/reports/monthly?year=2026&month=0", headers=h).status_code == 422


def test_pdf_export(client, db, alice, category, fuel, login):
    seed_expenses(db, alice, category, fuel)
    r = client.get("/api/reports/monthly/export/pdf?year=2026&month=10", headers=login("alice@example.com"))
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert 'filename="ecom-expense-report-2026-10.pdf"' in r.headers["content-disposition"]
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    assert "October 2026" in text and "350.35" in text and "Oct power" in text
    assert "Sep edge" not in text and "Nov edge" not in text


def test_pdf_export_handles_special_characters_and_empty_month(client, db, alice, category, login):
    from datetime import date
    db.add(Expense(title="Tom & Jerry <b>tools</b>", amount=Decimal("5.00"), expense_date=date(2026, 10, 2),
                   expense_type=ExpenseType.INDIVIDUAL, category_id=category.id, created_by=alice.id))
    db.commit()
    h = login("alice@example.com")
    assert client.get("/api/reports/monthly/export/pdf?year=2026&month=10", headers=h).status_code == 200
    assert client.get("/api/reports/monthly/export/pdf?year=2026&month=3", headers=h).status_code == 200


def test_excel_export(client, db, alice, category, fuel, login):
    seed_expenses(db, alice, category, fuel)
    r = client.get("/api/reports/monthly/export/excel?year=2026&month=10", headers=login("alice@example.com"))
    assert r.status_code == 200
    assert "spreadsheetml" in r.headers["content-type"]
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ["Summary", "Expenses"]
    assert wb["Summary"]["B5"].value == 350.35 and wb["Summary"]["B6"].value == 3
    ws = wb["Expenses"]
    assert ws.max_row == 5                                  # header + 3 rows + total row
    assert ws["G5"].value == "=SUM(G2:G4)"
    assert [ws.cell(row=r_, column=2).value for r_ in (2, 3, 4)] == ["Oct power", "Oct fuel", "Oct power 2"]


def test_health(client, db):
    assert client.get("/api/health").json() == {"status": "ok", "database": "connected"}
