"""add admin portal fields and organisation settings

Revision ID: e5c3f9a2b1d0
Revises: d4b2e8f1a9c0
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5c3f9a2b1d0"
down_revision: Union[str, None] = "d4b2e8f1a9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "expense_categories",
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.execute("UPDATE expense_categories SET sort_order = id WHERE sort_order = 0")

    op.add_column("expense_items", sa.Column("suggested_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_expense_items_suggested_by_users"),
        "expense_items",
        "users",
        ["suggested_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("expenses", sa.Column("incurred_by", sa.String(length=120), nullable=True))
    op.add_column("expenses", sa.Column("updated_by", sa.Integer(), nullable=True))
    op.add_column("expenses", sa.Column("import_key", sa.String(length=500), nullable=True))
    op.create_index(op.f("ix_expenses_import_key"), "expenses", ["import_key"], unique=False)
    op.create_foreign_key(
        op.f("fk_expenses_updated_by_users"),
        "expenses",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("petty_cash_entries", sa.Column("import_key", sa.String(length=500), nullable=True))
    op.create_index(
        op.f("ix_petty_cash_entries_import_key"), "petty_cash_entries", ["import_key"], unique=False
    )

    op.create_table(
        "organisation_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "organisation_name",
            sa.String(length=120),
            server_default="e-Com Services",
            nullable=False,
        ),
        sa.Column("currency", sa.String(length=10), server_default="GHS", nullable=False),
        sa.Column(
            "period_start_day", sa.Integer(), server_default=sa.text("1"), nullable=False
        ),
        sa.Column("opening_balance_amount", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("opening_balance_month", sa.Integer(), nullable=True),
        sa.Column("opening_balance_year", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organisation_settings")),
    )


def downgrade() -> None:
    op.drop_table("organisation_settings")

    op.drop_index(op.f("ix_petty_cash_entries_import_key"), table_name="petty_cash_entries")
    op.drop_column("petty_cash_entries", "import_key")

    op.drop_constraint(op.f("fk_expenses_updated_by_users"), "expenses", type_="foreignkey")
    op.drop_index(op.f("ix_expenses_import_key"), table_name="expenses")
    op.drop_column("expenses", "import_key")
    op.drop_column("expenses", "updated_by")
    op.drop_column("expenses", "incurred_by")

    op.drop_constraint(op.f("fk_expense_items_suggested_by_users"), "expense_items", type_="foreignkey")
    op.drop_column("expense_items", "suggested_by")

    op.drop_column("expense_categories", "sort_order")
