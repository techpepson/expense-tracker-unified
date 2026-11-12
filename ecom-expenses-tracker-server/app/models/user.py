import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, false, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._types import string_enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        string_enum(UserRole, 20), default=UserRole.EMPLOYEE, server_default=UserRole.EMPLOYEE.value
    )
    # The "designated expense recorder" permission (OD-04): lets an employee enter shared expenses.
    can_record_shared: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    profile_picture: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    expenses = relationship("Expense", back_populates="creator", foreign_keys="Expense.created_by")

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN
