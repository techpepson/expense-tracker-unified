import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import string_enum


class ExpenseType(str, enum.Enum):
    INDIVIDUAL = "individual"
    SHARED_OPERATIONAL = "shared_operational"


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
                      CheckConstraint("(unit_cost IS NULL) = (quantity IS NULL)", name="cost_pair"),
                      )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    # NUMERIC is exact. Never use float for money.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Optional. Only for expenses priced as unit cost x quantity; amount is then calculated.
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    expense_date: Mapped[date] = mapped_column(Date, index=True)
    expense_type: Mapped[ExpenseType] = mapped_column(string_enum(ExpenseType), index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("expense_categories.id", ondelete="RESTRICT"), index=True
    )
    item_id: Mapped[int | None] = mapped_column(
        ForeignKey("expense_items.id", ondelete="SET NULL"), index=True, nullable=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    incurred_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    import_key: Mapped[str | None] = mapped_column(String(500), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category = relationship("ExpenseCategory", back_populates="expenses")
    item = relationship("ExpenseItem")
    creator = relationship("User", back_populates="expenses", foreign_keys=[created_by])

    @property
    def item_name(self) -> str:
        return self.item.name if self.item is not None else self.title

    @property
    def total(self) -> Decimal:
        return self.amount

    @property
    def created_by_name(self) -> str:
        return self.creator.full_name if self.creator is not None else ""
