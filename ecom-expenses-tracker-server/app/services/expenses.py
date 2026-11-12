import math
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Expense, ExpenseCategory, ExpenseItem, ExpenseType, User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services.periods import month_bounds, year_bounds

SORT_COLUMNS = {
    "expense_date": Expense.expense_date,
    "amount": Expense.amount,
    "created_at": Expense.created_at,
    "title": Expense.title,
}


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def build_conditions(
    *,
    year: int | None = None,
    month: int | None = None,
    category_id: int | None = None,
    item_id: int | None = None,
    expense_type: ExpenseType | None = None,
    created_by: int | None = None,
    q: str | None = None,
) -> list:
    conditions = []
    if month is not None and year is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "month requires year")
    if year is not None:
        start, end = month_bounds(year, month) if month is not None else year_bounds(year)
        conditions += [Expense.expense_date >= start, Expense.expense_date <= end]
    if category_id is not None:
        conditions.append(Expense.category_id == category_id)
    if item_id is not None:
        conditions.append(Expense.item_id == item_id)
    if expense_type is not None:
        conditions.append(Expense.expense_type == expense_type)
    if created_by is not None:
        conditions.append(Expense.created_by == created_by)
    if q:
        pattern = f"%{_escape_like(q.strip())}%"
        conditions.append(
            Expense.title.ilike(pattern, escape="\\") | Expense.description.ilike(pattern, escape="\\")
        )
    return conditions


def with_relations():
    # Load category, creator, and item in the same query (avoids one extra query per row).
    return (joinedload(Expense.category), joinedload(Expense.creator), joinedload(Expense.item))


def list_expenses(
    db: Session, conditions: list, sort_by: str, order: str, page: int, page_size: int
) -> dict:
    total, total_amount = db.execute(
        select(func.count(Expense.id), func.coalesce(func.sum(Expense.amount), 0)).where(*conditions)
    ).one()

    column = SORT_COLUMNS[sort_by]
    primary = column.asc() if order == "asc" else column.desc()
    items = (
        db.execute(
            select(Expense)
            .options(*with_relations())
            .where(*conditions)
            .order_by(primary, Expense.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return {
        "items": items,
        "total": total,
        "total_amount": Decimal(total_amount),
        "page": page,
        "page_size": page_size,
        "pages": math.ceil(total / page_size) if total else 0,
    }


def get_expense_or_404(db: Session, expense_id: int) -> Expense:
    expense = db.execute(
        select(Expense).options(*with_relations()).where(Expense.id == expense_id)
    ).scalar_one_or_none()
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")
    return expense


# ---- business rules -------------------------------------------------------


def _check_can_use_type(user: User, expense_type: ExpenseType) -> None:
    if expense_type == ExpenseType.SHARED_OPERATIONAL and not (user.is_admin or user.can_record_shared):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You are not authorised to record shared operational expenses"
        )


def _check_can_modify(user: User, expense: Expense) -> None:
    if not (user.is_admin or expense.created_by == user.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only change expenses you recorded")


def _require_active_category(db: Session, category_id: int) -> None:
    category = db.get(ExpenseCategory, category_id)
    if category is None or not category.is_active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Category does not exist or is inactive")


def _resolve_item_and_title(
    db: Session, item_id: int | None, title: str | None
) -> tuple[int | None, str]:
    if item_id is not None:
        item = db.get(ExpenseItem, item_id)
        if item is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Item does not exist")
        resolved_title = title if title else item.name
        return item.id, resolved_title
    if not title:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide either title or item_id")
    return None, title


def resolve_cost(unit_cost: Decimal | None, quantity: Decimal | None, amount: Decimal | None):
    """Returns (unit_cost, quantity, amount) after applying the pricing rules."""
    if (unit_cost is None) != (quantity is None):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "unit_cost and quantity must be given together"
        )
    if unit_cost is not None:
        computed = (unit_cost * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if computed >= Decimal(10) ** 10:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "unit_cost x quantity is too large")
        if amount is not None and amount != computed:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"amount ({amount}) does not equal unit_cost x quantity ({computed}). "
                "Leave amount out, or send unit_cost and quantity as null to enter a plain amount.",
            )
        amount = computed
    if amount is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide amount, or both unit_cost and quantity"
        )
    return unit_cost, quantity, amount


# ---- create / update / delete --------------------------------------------


def create_expense(db: Session, user: User, data: ExpenseCreate) -> Expense:
    _check_can_use_type(user, data.expense_type)
    _require_active_category(db, data.category_id)
    values = data.model_dump()
    values["item_id"], values["title"] = _resolve_item_and_title(db, data.item_id, data.title)
    values["unit_cost"], values["quantity"], values["amount"] = resolve_cost(
        data.unit_cost, data.quantity, data.amount
    )
    expense = Expense(**values, created_by=user.id)
    db.add(expense)
    db.commit()
    return get_expense_or_404(db, expense.id)


def create_expenses_bulk(db: Session, user: User, items: list[ExpenseCreate]) -> list[Expense]:
    if not items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one expense is required")
    created_ids: list[int] = []
    for data in items:
        _check_can_use_type(user, data.expense_type)
        _require_active_category(db, data.category_id)
        values = data.model_dump()
        values["item_id"], values["title"] = _resolve_item_and_title(db, data.item_id, data.title)
        values["unit_cost"], values["quantity"], values["amount"] = resolve_cost(
            data.unit_cost, data.quantity, data.amount
        )
        expense = Expense(**values, created_by=user.id)
        db.add(expense)
        db.flush()
        created_ids.append(expense.id)
    db.commit()
    return [get_expense_or_404(db, eid) for eid in created_ids]


def update_expense(db: Session, user: User, expense_id: int, data: ExpenseUpdate) -> Expense:
    expense = get_expense_or_404(db, expense_id)
    _check_can_modify(user, expense)
    changes = data.model_dump(exclude_unset=True)
    if "item_id" in changes and changes["item_id"] is not None:
        item = db.get(ExpenseItem, changes["item_id"])
        if item is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Item does not exist")
        if "title" not in changes or not changes["title"]:
            changes["title"] = item.name
    if {"amount", "unit_cost", "quantity"} & changes.keys():
        unit_cost = changes.get("unit_cost", expense.unit_cost)
        quantity = changes.get("quantity", expense.quantity)
        amount = changes.get("amount", expense.amount)
        if unit_cost is not None and "amount" not in changes:
            amount = None  # recalculate from the new unit cost / quantity
        changes["unit_cost"], changes["quantity"], changes["amount"] = resolve_cost(unit_cost, quantity, amount)
    if "expense_type" in changes and changes["expense_type"] != expense.expense_type:
        _check_can_use_type(user, changes["expense_type"])
    if "category_id" in changes and changes["category_id"] != expense.category_id:
        _require_active_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(expense, field, value)
    db.commit()
    db.expire_all()  # force a fresh read so updated_at and relations are current
    return get_expense_or_404(db, expense_id)


def delete_expense(db: Session, user: User, expense_id: int) -> None:
    expense = get_expense_or_404(db, expense_id)
    _check_can_modify(user, expense)
    db.delete(expense)
    db.commit()
