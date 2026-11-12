"""add unit cost and quantity to expenses

Revision ID: c3a1d7e5f2b4
Revises: b9e8f88aadd9
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3a1d7e5f2b4"
down_revision: Union[str, None] = "b9e8f88aadd9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("unit_cost", sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column("expenses", sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=True))
    op.create_check_constraint(
        op.f("ck_expenses_cost_pair"), "expenses", "(unit_cost IS NULL) = (quantity IS NULL)"
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_expenses_cost_pair"), "expenses", type_="check")
    op.drop_column("expenses", "quantity")
    op.drop_column("expenses", "unit_cost")