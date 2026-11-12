from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.expense import ExpenseType
from app.schemas.expense import ExpenseOut
from app.schemas.petty_cash import PettyCashSummaryOut


class CategoryTotal(BaseModel):
    category_id: int
    category_name: str
    total: Decimal
    count: int
    percentage: Decimal


class TypeTotal(BaseModel):
    expense_type: ExpenseType
    total: Decimal
    count: int
    percentage: Decimal


class ItemBreakdown(BaseModel):
    item_id: int | str
    item_name: str
    entries: list[ExpenseOut]
    subtotal: Decimal


class CategoryBreakdown(BaseModel):
    category_id: int
    category_name: str
    total: Decimal
    items: list[ItemBreakdown]


class MonthlyReport(BaseModel):
    organisation: str
    currency: str
    year: int
    month: int
    period_start: date
    period_end: date
    total: Decimal
    count: int
    total_purchases: Decimal
    record_count: int
    individual_total: Decimal
    shared_total: Decimal
    petty_cash: PettyCashSummaryOut
    by_category: list[CategoryTotal]
    by_type: list[TypeTotal]
    categories: list[CategoryBreakdown]
    expenses: list[ExpenseOut]


class MonthlyTotal(BaseModel):
    month: int
    total: Decimal


class AnnualItemRow(BaseModel):
    item_id: int | str
    item_name: str
    monthly_totals: list[Decimal]
    year_total: Decimal


class AnnualCategoryRow(BaseModel):
    category_id: int
    category_name: str
    items: list[AnnualItemRow]
    monthly_totals: list[Decimal]
    year_total: Decimal


class AnnualReport(BaseModel):
    year: int
    months: list[MonthlyTotal]
    categories: list[AnnualCategoryRow]
    grand_total: Decimal
