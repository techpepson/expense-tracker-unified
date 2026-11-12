from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Integer, Numeric, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrganisationSettings(Base):
    __tablename__ = "organisation_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    organisation_name: Mapped[str] = mapped_column(
        String(120), default="e-Com Services", server_default="e-Com Services"
    )
    currency: Mapped[str] = mapped_column(String(10), default="GHS", server_default="GHS")
    period_start_day: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"))
    opening_balance_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    opening_balance_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opening_balance_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

