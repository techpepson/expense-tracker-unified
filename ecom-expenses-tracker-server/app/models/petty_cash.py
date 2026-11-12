import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import string_enum


class PettyCashEntryType(str, enum.Enum):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    CHARGE = "charge"


class PettyCashEntry(Base):
    __tablename__ = "petty_cash_entries"
    __table_args__ = (CheckConstraint("amount > 0", name="amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_type: Mapped[PettyCashEntryType] = mapped_column(
        string_enum(PettyCashEntryType, 20), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(String(300))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    import_key: Mapped[str | None] = mapped_column(String(500), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    creator = relationship("User")

    @property
    def created_by_name(self) -> str:
        return self.creator.full_name if self.creator else ""

