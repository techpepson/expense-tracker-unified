from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.expense import ExpenseType
from app.schemas.category import CategoryBrief
from app.schemas.user import UserBrief

T = TypeVar("T")


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    item_id: int | None = None
    description: str | None = None
    notes: str | None = None
    # Decimal (not float) so money stays exact. At most 12 digits, 2 after the point.
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    unit_cost: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    expense_date: date
    expense_type: ExpenseType
    category_id: int

    @field_validator("item_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "":
            return None
        return v

    @field_validator("expense_date")
    @classmethod
    def not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Expense date cannot be in the future")
        return v

    @model_validator(mode="after")
    def require_title_or_item(self):
        if not self.title and self.item_id is None:
            raise ValueError("Provide either title or item_id")
        return self


class ExpenseUpdate(BaseModel):
    """Partial update (PATCH/PUT): send only the fields you want to change."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    item_id: int | None = None
    description: str | None = None
    notes: str | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    unit_cost: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    quantity: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    expense_date: date | None = None
    expense_type: ExpenseType | None = None
    category_id: int | None = None

    @field_validator("item_id", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "":
            return None
        return v

    @field_validator("expense_date")
    @classmethod
    def not_in_future(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("Expense date cannot be in the future")
        return v

    @model_validator(mode="after")
    def required_fields_cannot_be_null(self):
        required = ("title", "amount", "expense_date", "expense_type", "category_id")
        for name in required:
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    item_id: int | None = None
    item_name: str
    description: str | None
    notes: str | None
    amount: Decimal
    total: Decimal
    unit_cost: Decimal | None
    quantity: Decimal | None
    expense_date: date
    expense_type: ExpenseType
    category_id: int
    created_by: int
    created_by_name: str
    created_at: datetime
    updated_at: datetime
    category: CategoryBrief
    creator: UserBrief


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class ExpensePage(Page[ExpenseOut]):
    # Sum of ALL expenses matching the filters, not just this page.
    total_amount: Decimal
