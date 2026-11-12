import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import string_enum


class ItemStatus(str, enum.Enum):
    APPROVED = "approved"
    PENDING = "pending"
    INACTIVE = "inactive"


class ExpenseItem(Base):
    __tablename__ = "expense_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("expense_categories.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[ItemStatus] = mapped_column(
        string_enum(ItemStatus, 20), default=ItemStatus.APPROVED, server_default=ItemStatus.APPROVED.value
    )
    suggested_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category = relationship("ExpenseCategory", back_populates="items")

