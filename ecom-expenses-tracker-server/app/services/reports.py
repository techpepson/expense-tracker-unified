from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Expense, ExpenseCategory, ExpenseType, OrganisationSettings
from app.schemas.expense import ExpenseOut
from app.schemas.report import (
    AnnualCategoryRow,
    AnnualItemRow,
    AnnualReport,
    CategoryBreakdown,
    CategoryTotal,
    ItemBreakdown,
    MonthlyReport,
    MonthlyTotal,
    TypeTotal,
)
from app.services.expenses import with_relations
from app.services.periods import month_bounds, year_bounds
from app.services.petty_cash import get_petty_cash_summary

ZERO = Decimal("0.00")


def _percentage(part: Decimal, whole: Decimal) -> Decimal:
    if whole == 0:
        return ZERO
    return (part / whole * 100).quantize(Decimal("0.01"))


def build_monthly_report(db: Session, year: int, month: int) -> MonthlyReport:
    """Everything is calculated from the saved expense rows, nothing is stored separately."""
    settings = get_settings()
    start, end = month_bounds(year, month)

    rows = (
        db.execute(
            select(Expense)
            .options(*with_relations())
            .where(Expense.expense_date >= start, Expense.expense_date <= end)
            .order_by(Expense.expense_date.asc(), Expense.id.asc())
        )
        .scalars()
        .all()
    )

    total = sum((e.amount for e in rows), ZERO)

    # Group in Python from the same rows we list, so totals and details can never disagree.
    cat_totals: dict[int, dict] = {}
    type_totals = {t: {"total": ZERO, "count": 0} for t in ExpenseType}
    for e in rows:
        c = cat_totals.setdefault(
            e.category_id,
            {"name": e.category.name, "total": ZERO, "count": 0, "rows": []},
        )
        c["total"] += e.amount
        c["count"] += 1
        c["rows"].append(e)
        type_totals[e.expense_type]["total"] += e.amount
        type_totals[e.expense_type]["count"] += 1

    sorted_cats = sorted(cat_totals.items(), key=lambda kv: kv[1]["total"], reverse=True)

    by_category = [
        CategoryTotal(
            category_id=cid,
            category_name=c["name"],
            total=c["total"],
            count=c["count"],
            percentage=_percentage(c["total"], total),
        )
        for cid, c in sorted_cats
    ]
    by_type = [
        TypeTotal(expense_type=t, total=v["total"], count=v["count"], percentage=_percentage(v["total"], total))
        for t, v in type_totals.items()
    ]

    categories_breakdown: list[CategoryBreakdown] = []
    for cid, c in sorted_cats:
        item_groups: dict[int | str, list[Expense]] = {}
        for exp in c["rows"]:
            key: int | str = exp.item_id if exp.item_id is not None else f"title:{exp.title}"
            item_groups.setdefault(key, []).append(exp)

        items_list = [
            ItemBreakdown(
                item_id=item_key,
                item_name=entries[0].item_name,
                entries=[ExpenseOut.model_validate(entry) for entry in entries],
                subtotal=sum((entry.amount for entry in entries), ZERO),
            )
            for item_key, entries in item_groups.items()
        ]
        categories_breakdown.append(
            CategoryBreakdown(
                category_id=cid,
                category_name=c["name"],
                total=c["total"],
                items=items_list,
            )
        )

    petty_cash = get_petty_cash_summary(db, year, month)
    org = db.scalar(select(OrganisationSettings).limit(1))
    org_name = org.organisation_name if org else settings.organisation_name
    currency = org.currency if org else settings.currency

    return MonthlyReport(
        organisation=org_name,
        currency=currency,
        year=year,
        month=month,
        period_start=start,
        period_end=end,
        total=total,
        count=len(rows),
        total_purchases=total,
        record_count=len(rows),
        individual_total=type_totals[ExpenseType.INDIVIDUAL]["total"],
        shared_total=type_totals[ExpenseType.SHARED_OPERATIONAL]["total"],
        petty_cash=petty_cash,
        by_category=by_category,
        by_type=by_type,
        categories=categories_breakdown,
        expenses=[ExpenseOut.model_validate(e) for e in rows],
    )


def build_annual_report(db: Session, year: int) -> AnnualReport:
    start, end = year_bounds(year)
    rows = (
        db.execute(
            select(Expense)
            .options(*with_relations())
            .where(Expense.expense_date >= start, Expense.expense_date <= end)
            .order_by(Expense.expense_date.asc(), Expense.id.asc())
        )
        .scalars()
        .all()
    )
    all_categories = db.scalars(
        select(ExpenseCategory).where(ExpenseCategory.is_active.is_(True)).order_by(ExpenseCategory.name)
    ).all()

    months = [
        MonthlyTotal(
            month=m,
            total=sum((e.amount for e in rows if e.expense_date.month == m), ZERO),
        )
        for m in range(1, 13)
    ]

    categories_rows: list[AnnualCategoryRow] = []
    for cat in all_categories:
        cat_expenses = [e for e in rows if e.category_id == cat.id]
        cat_monthly = [
            sum((e.amount for e in cat_expenses if e.expense_date.month == m), ZERO)
            for m in range(1, 13)
        ]
        item_groups: dict[int | str, list[Expense]] = {}
        for exp in cat_expenses:
            key: int | str = exp.item_id if exp.item_id is not None else f"title:{exp.title}"
            item_groups.setdefault(key, []).append(exp)

        cat_items: list[AnnualItemRow] = []
        for item_key, item_exps in item_groups.items():
            it_monthly = [
                sum((e.amount for e in item_exps if e.expense_date.month == m), ZERO)
                for m in range(1, 13)
            ]
            cat_items.append(
                AnnualItemRow(
                    item_id=item_key,
                    item_name=item_exps[0].item_name,
                    monthly_totals=it_monthly,
                    year_total=sum(it_monthly, ZERO),
                )
            )

        categories_rows.append(
            AnnualCategoryRow(
                category_id=cat.id,
                category_name=cat.name,
                items=cat_items,
                monthly_totals=cat_monthly,
                year_total=sum(cat_monthly, ZERO),
            )
        )

    grand_total = sum((m.total for m in months), ZERO)
    return AnnualReport(
        year=year,
        months=months,
        categories=categories_rows,
        grand_total=grand_total,
    )
