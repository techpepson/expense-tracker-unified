from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.petty_cash import PettyCashEntryType


class PettyCashEntryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    entry_type: PettyCashEntryType
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    entry_date: date
    description: str = Field(min_length=1, max_length=300)


class PettyCashEntryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    entry_type: PettyCashEntryType | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    entry_date: date | None = None
    description: str | None = Field(default=None, min_length=1, max_length=300)


class PettyCashEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_type: PettyCashEntryType
    amount: Decimal
    entry_date: date
    description: str
    created_by: int
    created_by_name: str
    created_at: datetime


class PettyCashSummaryOut(BaseModel):
    opening_balance: Decimal
    cash_in: Decimal
    cash_out_total: Decimal
    charges: Decimal
    closing_balance: Decimal
    cash_used: Decimal
    entries: list[PettyCashEntryOut]

