"""add items, petty cash, and profile picture

Revision ID: d4b2e8f1a9c0
Revises: c3a1d7e5f2b4
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4b2e8f1a9c0"
down_revision: Union[str, None] = "c3a1d7e5f2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_picture", sa.Text(), nullable=True))

    op.create_table(
        "expense_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "status",
            sa.Enum("approved", "pending", name="itemstatus", native_enum=False, length=20),
            server_default="approved",
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["expense_categories.id"],
            name=op.f("fk_expense_items_category_id_expense_categories"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expense_items")),
    )
    op.create_index(op.f("ix_expense_items_category_id"), "expense_items", ["category_id"], unique=False)

    op.add_column("expenses", sa.Column("item_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_expenses_item_id"), "expenses", ["item_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_expenses_item_id_expense_items"),
        "expenses",
        "expense_items",
        ["item_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "petty_cash_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "entry_type",
            sa.Enum("cash_in", "cash_out", "charge", name="pettycashentrytype", native_enum=False, length=20),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount > 0", name=op.f("ck_petty_cash_entries_amount_positive")),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_petty_cash_entries_created_by_users"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_petty_cash_entries")),
    )
    op.create_index(op.f("ix_petty_cash_entries_created_by"), "petty_cash_entries", ["created_by"], unique=False)
    op.create_index(op.f("ix_petty_cash_entries_entry_date"), "petty_cash_entries", ["entry_date"], unique=False)
    op.create_index(op.f("ix_petty_cash_entries_entry_type"), "petty_cash_entries", ["entry_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_petty_cash_entries_entry_type"), table_name="petty_cash_entries")
    op.drop_index(op.f("ix_petty_cash_entries_entry_date"), table_name="petty_cash_entries")
    op.drop_index(op.f("ix_petty_cash_entries_created_by"), table_name="petty_cash_entries")
    op.drop_table("petty_cash_entries")

    op.drop_constraint(op.f("fk_expenses_item_id_expense_items"), "expenses", type_="foreignkey")
    op.drop_index(op.f("ix_expenses_item_id"), table_name="expenses")
    op.drop_column("expenses", "item_id")

    op.drop_index(op.f("ix_expense_items_category_id"), table_name="expense_items")
    op.drop_table("expense_items")

    op.drop_column("users", "profile_picture")

