import calendar
import re
import secrets
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.security import hash_password
from app.database import get_db
from app.models import (
    Expense,
    ExpenseCategory,
    ExpenseItem,
    ExpenseType,
    ItemStatus,
    OrganisationSettings,
    PettyCashEntry,
    PettyCashEntryType,
    User,
    UserRole,
)
from app.services.expenses import with_relations


class AdminError(Exception):
    def __init__(
        self,
        status_code: int,
        message: str,
        code: str = "error",
        errors: dict[str, list[str]] | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.errors = errors or {}


def invalid(field: str, message: str) -> AdminError:
    return AdminError(422, message, "validation_error", {field: [message]})


def not_found(what: str) -> AdminError:
    return AdminError(404, f"{what} not found", "not_found")


def require_admin_portal(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise AdminError(403, "Employee accounts sign in on the employee site", "employee_account")
    return user


router = APIRouter(prefix="/admin", tags=["Admin Portal"], dependencies=[Depends(require_admin_portal)])

ZERO = Decimal("0.00")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _name_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


def _parse_int_id(raw: str | int, what: str = "Record") -> int:
    try:
        return int(str(raw).strip())
    except (ValueError, TypeError):
        raise not_found(what)


def _get_or_create_settings(db: Session) -> OrganisationSettings:
    org = db.scalar(select(OrganisationSettings).limit(1))
    if org is None:
        cfg = get_settings()
        org = OrganisationSettings(
            organisation_name=cfg.organisation_name,
            currency=cfg.currency,
            period_start_day=1,
            opening_balance_amount=Decimal("930.25"),
            opening_balance_month=1,
            opening_balance_year=2026,
        )
        db.add(org)
        db.commit()
        db.refresh(org)
    return org


def _period_bounds(year: int, month: int, start_day: int = 1) -> tuple[date, date]:
    day = max(1, min(28, int(start_day or 1)))
    if day == 1:
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, 1), date(year, month, last_day)
    prev_month = 12 if month == 1 else month - 1
    prev_year = year - 1 if month == 1 else year
    return date(prev_year, prev_month, day), date(year, month, day - 1)


def _date_in_period(d: date, month: int, year: int, start_day: int = 1) -> bool:
    start, end = _period_bounds(year, month, start_day)
    return start <= d <= end


# ---------------- Serializers ----------------


def serialize_user(u: User) -> dict[str, Any]:
    return {
        "id": str(u.id),
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role.value,
        "can_record_shared": u.can_record_shared,
        "profile_picture": u.profile_picture,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else "",
    }


def serialize_category(c: ExpenseCategory, item_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(c.id),
        "name": c.name,
        "description": c.description or "",
        "is_active": c.is_active,
        "sort_order": c.sort_order or c.id,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "item_count": item_count,
    }


def serialize_item(i: ExpenseItem, usage_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(i.id),
        "category_id": str(i.category_id),
        "name": i.name,
        "status": i.status.value,
        "usage_count": usage_count,
        "suggested_by": str(i.suggested_by) if i.suggested_by is not None else None,
        "created_at": i.created_at.isoformat() if i.created_at else "",
    }


def serialize_expense(e: Expense) -> dict[str, Any]:
    total = float(e.amount)
    unit_cost = float(e.unit_cost) if e.unit_cost is not None else total
    quantity = float(e.quantity) if e.quantity is not None else 1.0
    return {
        "id": str(e.id),
        "category_id": str(e.category_id),
        "item_id": str(e.item_id) if e.item_id is not None else "",
        "item_name": e.item_name,
        "unit_cost": unit_cost,
        "quantity": quantity,
        "total": total,
        "description": e.description or "",
        "expense_date": e.expense_date.isoformat(),
        "expense_type": e.expense_type.value,
        "created_by": str(e.created_by),
        "incurred_by": e.incurred_by,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else "",
        "updated_at": e.updated_at.isoformat() if e.updated_at else "",
        "updated_by": str(e.updated_by) if e.updated_by is not None else None,
        "import_key": e.import_key,
    }


def serialize_petty_entry(p: PettyCashEntry, running_balance: float | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(p.id),
        "entry_type": p.entry_type.value,
        "amount": float(p.amount),
        "entry_date": p.entry_date.isoformat(),
        "description": p.description or "",
        "created_by": str(p.created_by),
        "created_at": p.created_at.isoformat() if p.created_at else "",
        "import_key": p.import_key,
    }
    if running_balance is not None:
        out["running_balance"] = running_balance
    return out


# ---------------- Categories ----------------


def _list_categories_data(db: Session) -> list[dict[str, Any]]:
    cats = db.scalars(
        select(ExpenseCategory).order_by(ExpenseCategory.sort_order.asc(), ExpenseCategory.id.asc())
    ).all()
    counts = dict(
        db.execute(
            select(ExpenseItem.category_id, func.count(ExpenseItem.id))
            .where(ExpenseItem.status != ItemStatus.INACTIVE)
            .group_by(ExpenseItem.category_id)
        ).all()
    )
    return [serialize_category(c, int(counts.get(c.id, 0))) for c in cats]


@router.get("/categories")
def list_admin_categories(db: Session = Depends(get_db)):
    return _list_categories_data(db)


@router.post("/categories", status_code=status.HTTP_201_CREATED)
def create_admin_category(payload: dict[str, Any], db: Session = Depends(get_db)):
    name = str(payload.get("name") or "").strip()
    if not name:
        raise invalid("name", "Name is required")
    existing = db.scalars(select(ExpenseCategory)).all()
    if any(_name_key(c.name) == _name_key(name) for c in existing):
        raise invalid("name", "A category with this name already exists")
    max_order = max((c.sort_order or c.id for c in existing), default=0)
    cat = ExpenseCategory(
        name=name,
        description=str(payload.get("description") or "").strip(),
        is_active=bool(payload.get("is_active", True)),
        sort_order=max_order + 1,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return serialize_category(cat, 0)


@router.put("/categories/reorder")
def reorder_admin_categories(payload: dict[str, Any], db: Session = Depends(get_db)):
    raw_ids = payload.get("ids")
    if not isinstance(raw_ids, list):
        raise invalid("ids", "Provide a list of category IDs")
    cats = db.scalars(select(ExpenseCategory)).all()
    cat_by_id = {str(c.id): c for c in cats}
    str_ids = [str(x) for x in raw_ids]
    if len(str_ids) != len(cat_by_id) or not all(cid in cat_by_id for cid in str_ids):
        raise invalid("ids", "The reorder list must contain every category exactly once")
    for idx, cid in enumerate(str_ids, start=1):
        cat_by_id[cid].sort_order = idx
    db.commit()
    return _list_categories_data(db)


@router.put("/categories/{category_id}")
@router.patch("/categories/{category_id}")
def update_admin_category(category_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    cid = _parse_int_id(category_id, "Category")
    cat = db.get(ExpenseCategory, cid)
    if cat is None:
        raise not_found("Category")
    if "name" in payload and payload["name"] is not None:
        name = str(payload["name"]).strip()
        if not name:
            raise invalid("name", "Name is required")
        others = db.scalars(select(ExpenseCategory).where(ExpenseCategory.id != cid)).all()
        if any(_name_key(c.name) == _name_key(name) for c in others):
            raise invalid("name", "A category with this name already exists")
        cat.name = name
    if "description" in payload and payload["description"] is not None:
        cat.description = str(payload["description"]).strip()
    if "is_active" in payload and payload["is_active"] is not None:
        cat.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(cat)
    item_count = (
        db.scalar(
            select(func.count(ExpenseItem.id)).where(
                ExpenseItem.category_id == cat.id,
                ExpenseItem.status != ItemStatus.INACTIVE,
            )
        )
        or 0
    )
    return serialize_category(cat, int(item_count))


# ---------------- Items ----------------


def _usage_counts(db: Session) -> dict[int, int]:
    return dict(
        db.execute(
            select(Expense.item_id, func.count(Expense.id))
            .where(Expense.item_id.is_not(None))
            .group_by(Expense.item_id)
        ).all()
    )


def _assert_unique_item(
    db: Session, category_id: int, name: str, exclude_id: int | None = None
) -> None:
    trimmed = re.sub(r"\s+", " ", name.strip())
    if not trimmed:
        raise invalid("name", "Name is required")
    items = db.scalars(
        select(ExpenseItem).where(
            ExpenseItem.category_id == category_id,
            ExpenseItem.status != ItemStatus.PENDING,
        )
    ).all()
    for it in items:
        if exclude_id is not None and it.id == exclude_id:
            continue
        if _name_key(it.name) == _name_key(trimmed):
            raise invalid("name", f'"{it.name}" already exists in this category — merge instead')


@router.get("/items")
def list_admin_items(
    status: str | None = Query(None),
    category_id: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
):
    cats = db.scalars(select(ExpenseCategory)).all()
    cat_order = {c.id: (c.sort_order or c.id) for c in cats}
    usage = _usage_counts(db)
    items = db.scalars(select(ExpenseItem).order_by(ExpenseItem.id.asc())).all()
    if status:
        items = [i for i in items if i.status.value == status]
    if category_id:
        cid = _parse_int_id(category_id, "Category")
        items = [i for i in items if i.category_id == cid]
    if search:
        q = search.strip().lower()
        items = [i for i in items if q in i.name.lower()]
    items.sort(key=lambda i: (cat_order.get(i.category_id, 9999), i.id))
    return [serialize_item(i, int(usage.get(i.id, 0))) for i in items]


@router.post("/items", status_code=status.HTTP_201_CREATED)
def create_admin_item(payload: dict[str, Any], db: Session = Depends(get_db)):
    raw_cat = payload.get("category_id")
    if not raw_cat:
        raise invalid("category_id", "Choose a category")
    cid = _parse_int_id(raw_cat, "Category")
    cat = db.get(ExpenseCategory, cid)
    if cat is None:
        raise invalid("category_id", "Choose a category")
    name = re.sub(r"\s+", " ", str(payload.get("name") or "").strip())
    _assert_unique_item(db, cid, name)
    raw_status = str(payload.get("status") or "approved")
    item_status = (
        ItemStatus(raw_status)
        if raw_status in {s.value for s in ItemStatus}
        else ItemStatus.APPROVED
    )
    item = ExpenseItem(category_id=cid, name=name, status=item_status, suggested_by=None)
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_item(item, 0)


@router.put("/items/{item_id}")
@router.patch("/items/{item_id}")
def update_admin_item(item_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    iid = _parse_int_id(item_id, "Item")
    item = db.get(ExpenseItem, iid)
    if item is None:
        raise not_found("Item")

    new_cat_id = (
        _parse_int_id(payload["category_id"], "Category")
        if payload.get("category_id") is not None
        else item.category_id
    )
    if db.get(ExpenseCategory, new_cat_id) is None:
        raise invalid("category_id", "Choose a category")
    new_name = (
        re.sub(r"\s+", " ", str(payload["name"]).strip())
        if payload.get("name") is not None
        else item.name
    )
    if payload.get("name") is not None or payload.get("category_id") is not None:
        _assert_unique_item(db, new_cat_id, new_name, exclude_id=iid)

    item.name = new_name
    if new_cat_id != item.category_id:
        item.category_id = new_cat_id
        for exp in db.scalars(select(Expense).where(Expense.item_id == iid)).all():
            exp.category_id = new_cat_id
    for exp in db.scalars(select(Expense).where(Expense.item_id == iid)).all():
        exp.title = item.name

    if payload.get("status") is not None:
        raw_status = str(payload["status"])
        if raw_status in {s.value for s in ItemStatus}:
            item.status = ItemStatus(raw_status)

    db.commit()
    db.refresh(item)
    usage = int(
        db.scalar(select(func.count(Expense.id)).where(Expense.item_id == item.id)) or 0
    )
    return serialize_item(item, usage)


@router.post("/items/{item_id}/merge")
def merge_admin_item(item_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    source_id = _parse_int_id(item_id, "Item")
    raw_target = payload.get("target_id")
    if not raw_target:
        raise invalid("target_id", "Target item not found")
    try:
        target_id = int(str(raw_target).strip())
    except (ValueError, TypeError):
        raise invalid("target_id", "Target item not found")

    if source_id == target_id:
        raise invalid("target_id", "Choose a different item to merge into")

    source = db.get(ExpenseItem, source_id)
    if source is None:
        raise not_found("Item")
    target = db.get(ExpenseItem, target_id)
    if target is None:
        raise invalid("target_id", "Target item not found")

    affected = db.scalars(select(Expense).where(Expense.item_id == source_id)).all()
    moved = len(affected)
    for exp in affected:
        exp.item_id = target.id
        exp.title = target.name
        exp.category_id = target.category_id

    db.delete(source)
    db.commit()
    db.refresh(target)
    usage = int(
        db.scalar(select(func.count(Expense.id)).where(Expense.item_id == target.id)) or 0
    )
    return {"moved": moved, "target": serialize_item(target, usage)}


@router.post("/items/{item_id}/approve")
def approve_admin_item(item_id: str, db: Session = Depends(get_db)):
    iid = _parse_int_id(item_id, "Item")
    item = db.get(ExpenseItem, iid)
    if item is None:
        raise not_found("Item")
    _assert_unique_item(db, item.category_id, item.name, exclude_id=iid)
    item.status = ItemStatus.APPROVED
    db.commit()
    db.refresh(item)
    usage = int(
        db.scalar(select(func.count(Expense.id)).where(Expense.item_id == item.id)) or 0
    )
    return serialize_item(item, usage)


@router.post("/items/{item_id}/reject")
def reject_admin_item(item_id: str, db: Session = Depends(get_db)):
    iid = _parse_int_id(item_id, "Item")
    item = db.get(ExpenseItem, iid)
    if item is None:
        raise not_found("Item")
    if item.status != ItemStatus.PENDING:
        raise AdminError(409, "Only pending suggestions can be rejected", "conflict")
    used = db.scalar(select(func.count(Expense.id)).where(Expense.item_id == iid)) or 0
    if used > 0:
        raise AdminError(
            409,
            "This suggestion is used by expense records — merge it into an existing item instead",
            "conflict",
        )
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---------------- Users ----------------


@router.get("/users")
def list_admin_users(
    search: str | None = Query(None),
    role: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    users = db.scalars(select(User).order_by(User.id.asc())).all()
    if search:
        q = search.strip().lower()
        users = [u for u in users if q in u.full_name.lower() or q in u.email.lower()]
    if role:
        users = [u for u in users if u.role.value == role]
    if status == "active":
        users = [u for u in users if u.is_active]
    elif status == "inactive":
        users = [u for u in users if not u.is_active]
    return [serialize_user(u) for u in users]


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_admin_user(payload: dict[str, Any], db: Session = Depends(get_db)):
    full_name = str(payload.get("full_name") or "").strip()
    if not full_name:
        raise invalid("full_name", "Full name is required")
    email = str(payload.get("email") or "").strip().lower()
    if not EMAIL_RE.match(email):
        raise invalid("email", "Enter a valid email address")
    if db.scalar(select(User.id).where(func.lower(User.email) == email)) is not None:
        raise invalid("email", "This email is already in use")
    password = str(payload.get("password") or "")
    if len(password) < 8:
        raise invalid("password", "Temporary password must be at least 8 characters")
    raw_role = str(payload.get("role") or "employee")
    role = UserRole.ADMIN if raw_role == "admin" else UserRole.EMPLOYEE
    user = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        can_record_shared=bool(payload.get("can_record_shared", False)),
        is_active=bool(payload.get("is_active", True)),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.put("/users/{user_id}")
@router.patch("/users/{user_id}")
def update_admin_user(
    user_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    uid = _parse_int_id(user_id, "User")
    user = db.get(User, uid)
    if user is None:
        raise not_found("User")

    if user.id == admin.id:
        if payload.get("is_active") is False:
            raise invalid("is_active", "You cannot deactivate your own account")
        if payload.get("role") is not None and payload.get("role") != "admin":
            raise invalid("role", "You cannot remove your own administrator role")

    if "email" in payload and payload["email"] is not None:
        email = str(payload["email"]).strip().lower()
        if not EMAIL_RE.match(email):
            raise invalid("email", "Enter a valid email address")
        clash = db.scalar(
            select(User.id).where(func.lower(User.email) == email, User.id != uid)
        )
        if clash is not None:
            raise invalid("email", "This email is already in use")
        user.email = email

    if "full_name" in payload and payload["full_name"] is not None:
        full_name = str(payload["full_name"]).strip()
        if not full_name:
            raise invalid("full_name", "Full name is required")
        user.full_name = full_name

    if "role" in payload and payload["role"] is not None:
        user.role = UserRole.ADMIN if str(payload["role"]) == "admin" else UserRole.EMPLOYEE

    if "can_record_shared" in payload and payload["can_record_shared"] is not None:
        user.can_record_shared = bool(payload["can_record_shared"])

    if "is_active" in payload and payload["is_active"] is not None:
        user.is_active = bool(payload["is_active"])

    if payload.get("password"):
        pw = str(payload["password"])
        if len(pw) < 8:
            raise invalid("password", "Password must be at least 8 characters")
        user.password_hash = hash_password(pw)

    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.post("/users/{user_id}/reset-password")
def reset_admin_user_password(user_id: str, db: Session = Depends(get_db)):
    uid = _parse_int_id(user_id, "User")
    user = db.get(User, uid)
    if user is None:
        raise not_found("User")
    temp = f"Tmp-{secrets.token_hex(3)}{secrets.randbelow(90) + 10}"
    user.password_hash = hash_password(temp)
    db.commit()
    return {"temporary_password": temp}


# ---------------- Expenses ----------------


def _validate_and_prepare_expense(
    db: Session, payload: dict[str, Any], existing: Expense | None = None
) -> dict[str, Any]:
    raw_cat = payload.get("category_id")
    if not raw_cat:
        raise invalid("category_id", "Choose a category")
    try:
        cid = int(str(raw_cat).strip())
    except (ValueError, TypeError):
        raise invalid("category_id", "Choose a category")
    cat = db.get(ExpenseCategory, cid)
    if cat is None:
        raise invalid("category_id", "Choose a category")
    keeping_cat = existing is not None and existing.category_id == cid
    if not cat.is_active and not keeping_cat:
        raise invalid("category_id", "This category is inactive")

    raw_item = payload.get("item_id")
    if not raw_item:
        raise invalid("item_id", "Choose an item from this category")
    try:
        iid = int(str(raw_item).strip())
    except (ValueError, TypeError):
        raise invalid("item_id", "Choose an item from this category")
    item = db.get(ExpenseItem, iid)
    if item is None or item.category_id != cid:
        raise invalid("item_id", "Choose an item from this category")
    keeping_item = existing is not None and existing.item_id == iid
    if item.status != ItemStatus.APPROVED and not keeping_item:
        raise invalid("item_id", "Only approved items can be used")

    try:
        unit_cost = Decimal(str(payload.get("unit_cost", 0))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except Exception:
        raise invalid("unit_cost", "Unit cost must be greater than zero")
    if unit_cost <= 0:
        raise invalid("unit_cost", "Unit cost must be greater than zero")

    try:
        quantity = Decimal(str(payload.get("quantity", 0))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except Exception:
        raise invalid("quantity", "Quantity must be greater than zero")
    if quantity <= 0:
        raise invalid("quantity", "Quantity must be greater than zero")

    amount = (unit_cost * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    raw_date = str(payload.get("expense_date") or "")
    try:
        exp_date = date.fromisoformat(raw_date)
    except ValueError:
        raise invalid("expense_date", "Enter a valid date")

    raw_type = str(payload.get("expense_type") or "")
    if raw_type not in {"individual", "shared_operational"}:
        raise invalid("expense_type", "Choose an expense type")

    return {
        "category_id": cid,
        "item_id": item.id,
        "title": item.name,
        "unit_cost": unit_cost,
        "quantity": quantity,
        "amount": amount,
        "description": str(payload.get("description") or "").strip(),
        "expense_date": exp_date,
        "expense_type": ExpenseType(raw_type),
        "incurred_by": str(payload.get("incurred_by") or "").strip() or None,
        "notes": str(payload.get("notes") or "").strip() or None,
    }


def _filter_admin_expenses(
    db: Session,
    *,
    month: int | None = None,
    year: int | None = None,
    category_id: str | None = None,
    item_id: str | None = None,
    expense_type: str | None = None,
    created_by: str | None = None,
    search: str | None = None,
    sort: str | None = None,
) -> list[dict[str, Any]]:
    org = _get_or_create_settings(db)
    start_day = org.period_start_day
    rows = (
        db.execute(select(Expense).options(*with_relations()).order_by(Expense.id.desc()))
        .scalars()
        .all()
    )
    items = [serialize_expense(e) for e in rows]
    if month and year:
        start, end = _period_bounds(year, month, start_day)
        s_iso, e_iso = start.isoformat(), end.isoformat()
        items = [e for e in items if s_iso <= e["expense_date"] <= e_iso]
    elif year:
        prefix = f"{year}-"
        items = [e for e in items if e["expense_date"].startswith(prefix)]

    if category_id:
        items = [e for e in items if e["category_id"] == str(category_id)]
    if item_id:
        items = [e for e in items if e["item_id"] == str(item_id)]
    if expense_type:
        items = [e for e in items if e["expense_type"] == expense_type]
    if created_by:
        items = [e for e in items if e["created_by"] == str(created_by)]
    if search:
        q = search.strip().lower()
        items = [
            e
            for e in items
            if q in e["item_name"].lower()
            or q in e["description"].lower()
            or q in (e["incurred_by"] or "").lower()
            or q in (e["notes"] or "").lower()
        ]

    raw_sort = sort or "expense_date:desc"
    parts = raw_sort.split(":")
    key = parts[0] if parts[0] in {"expense_date", "total", "unit_cost", "quantity", "item_name", "created_at"} else "expense_date"
    reverse = (parts[1] if len(parts) > 1 else "desc") != "asc"
    items.sort(key=lambda e: (e.get(key), e.get("created_at", "")), reverse=reverse)
    return items


@router.get("/expenses")
def list_admin_expenses(
    month: int | None = Query(None),
    year: int | None = Query(None),
    category_id: str | None = Query(None),
    item_id: str | None = Query(None),
    expense_type: str | None = Query(None),
    created_by: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=10000),
    sort: str | None = Query(None),
    db: Session = Depends(get_db),
):
    all_items = _filter_admin_expenses(
        db,
        month=month,
        year=year,
        category_id=category_id,
        item_id=item_id,
        expense_type=expense_type,
        created_by=created_by,
        search=search,
        sort=sort,
    )
    total_amount = round(sum(e["total"] for e in all_items), 2)
    sliced = all_items[(page - 1) * limit : page * limit]
    return {
        "data": sliced,
        "page": page,
        "limit": limit,
        "total": len(all_items),
        "total_amount": total_amount,
    }


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
def create_admin_expense(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    vals = _validate_and_prepare_expense(db, payload)
    exp = Expense(**vals, created_by=admin.id)
    db.add(exp)
    db.commit()
    loaded = db.execute(
        select(Expense).options(*with_relations()).where(Expense.id == exp.id)
    ).scalar_one()
    return serialize_expense(loaded)


@router.post("/expenses/bulk", status_code=status.HTTP_201_CREATED)
def create_admin_expenses_bulk(
    payload: dict[str, Any] | list[dict[str, Any]],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    lines = payload.get("lines") if isinstance(payload, dict) else payload
    if not isinstance(lines, list) or not lines:
        raise invalid("lines", "Add at least one line")
    prepared = [_validate_and_prepare_expense(db, line) for line in lines]
    ids: list[int] = []
    for vals in prepared:
        exp = Expense(**vals, created_by=admin.id)
        db.add(exp)
        db.flush()
        ids.append(exp.id)
    db.commit()
    rows = (
        db.execute(select(Expense).options(*with_relations()).where(Expense.id.in_(ids)))
        .scalars()
        .all()
    )
    by_id = {r.id: r for r in rows}
    return [serialize_expense(by_id[i]) for i in ids if i in by_id]


@router.get("/expenses/{expense_id}")
def get_admin_expense(expense_id: str, db: Session = Depends(get_db)):
    eid = _parse_int_id(expense_id, "Expense")
    exp = db.execute(
        select(Expense).options(*with_relations()).where(Expense.id == eid)
    ).scalar_one_or_none()
    if exp is None:
        raise not_found("Expense")
    return serialize_expense(exp)


@router.put("/expenses/{expense_id}")
@router.patch("/expenses/{expense_id}")
def update_admin_expense(
    expense_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    eid = _parse_int_id(expense_id, "Expense")
    exp = db.execute(
        select(Expense).options(*with_relations()).where(Expense.id == eid)
    ).scalar_one_or_none()
    if exp is None:
        raise not_found("Expense")
    vals = _validate_and_prepare_expense(db, payload, existing=exp)
    for k, v in vals.items():
        setattr(exp, k, v)
    exp.updated_by = admin.id
    db.commit()
    db.expire_all()
    reloaded = db.execute(
        select(Expense).options(*with_relations()).where(Expense.id == eid)
    ).scalar_one()
    return serialize_expense(reloaded)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_expense(expense_id: str, db: Session = Depends(get_db)):
    eid = _parse_int_id(expense_id, "Expense")
    exp = db.get(Expense, eid)
    if exp is None:
        raise not_found("Expense")
    db.delete(exp)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------- Petty Cash ----------------


def _compute_petty_cash_month(db: Session, month: int, year: int) -> dict[str, Any]:
    org = _get_or_create_settings(db)
    start_day = org.period_start_day
    start, end = _period_bounds(year, month, start_day)

    all_entries = db.scalars(
        select(PettyCashEntry).order_by(PettyCashEntry.entry_date.asc(), PettyCashEntry.id.asc())
    ).all()

    has_opening = (
        org.opening_balance_amount is not None
        and org.opening_balance_month is not None
        and org.opening_balance_year is not None
    )
    anchor_amount = float(org.opening_balance_amount) if has_opening else 0.0
    anchor_ym = (
        (int(org.opening_balance_year), int(org.opening_balance_month))
        if has_opening
        else (year, month)
    )

    earlier_entries = [e for e in all_entries if e.entry_date < start]
    is_first_month = len(earlier_entries) == 0 and (
        not has_opening or (year, month) <= anchor_ym
    )

    opening_balance = anchor_amount if (has_opening and (year, month) >= anchor_ym) else 0.0
    for e in earlier_entries:
        if has_opening:
            ob_start, _ = _period_bounds(anchor_ym[0], anchor_ym[1], start_day)
            if e.entry_date < ob_start:
                continue
        amt = float(e.amount)
        if e.entry_type == PettyCashEntryType.CASH_IN:
            opening_balance = round(opening_balance + amt, 2)
        else:
            opening_balance = round(opening_balance - amt, 2)

    month_entries = [e for e in all_entries if start <= e.entry_date <= end]
    cash_in = 0.0
    cash_used = 0.0
    charges = 0.0
    running = opening_balance
    ledger: list[dict[str, Any]] = []

    for e in month_entries:
        amt = float(e.amount)
        if e.entry_type == PettyCashEntryType.CASH_IN:
            cash_in = round(cash_in + amt, 2)
            running = round(running + amt, 2)
        elif e.entry_type == PettyCashEntryType.CASH_OUT:
            cash_used = round(cash_used + amt, 2)
            running = round(running - amt, 2)
        else:
            charges = round(charges + amt, 2)
            running = round(running - amt, 2)
        ledger.append(serialize_petty_entry(e, running))

    cash_out_total = round(cash_used + charges, 2)
    closing_balance = round(opening_balance + cash_in - cash_out_total, 2)

    return {
        "month": month,
        "year": year,
        "summary": {
            "opening_balance": opening_balance,
            "cash_in": cash_in,
            "cash_out_total": cash_out_total,
            "charges": charges,
            "cash_used": cash_used,
            "closing_balance": closing_balance,
        },
        "entries": ledger,
        "is_first_month": is_first_month,
        "opening_balance_set": has_opening,
    }


def _validate_petty_input(payload: dict[str, Any]) -> dict[str, Any]:
    raw_type = str(payload.get("entry_type") or "")
    if raw_type not in {"cash_in", "cash_out", "charge"}:
        raise invalid("entry_type", "Choose an entry type")
    try:
        amount = Decimal(str(payload.get("amount", 0))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except Exception:
        raise invalid("amount", "Amount must be greater than zero")
    if amount <= 0:
        raise invalid("amount", "Amount must be greater than zero")
    raw_date = str(payload.get("entry_date") or "")
    try:
        entry_date = date.fromisoformat(raw_date)
    except ValueError:
        raise invalid("entry_date", "Enter a valid date")
    description = str(payload.get("description") or "").strip() or raw_type.replace("_", " ").title()
    return {
        "entry_type": PettyCashEntryType(raw_type),
        "amount": amount,
        "entry_date": entry_date,
        "description": description,
    }


@router.get("/petty-cash")
def get_admin_petty_cash(
    month: int | None = Query(None),
    year: int | None = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()
    return _compute_petty_cash_month(db, month or today.month, year or today.year)


@router.post("/petty-cash/entries", status_code=status.HTTP_201_CREATED)
def create_admin_petty_cash(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    vals = _validate_petty_input(payload)
    entry = PettyCashEntry(**vals, created_by=admin.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return serialize_petty_entry(entry)


@router.put("/petty-cash/entries/{entry_id}")
@router.patch("/petty-cash/entries/{entry_id}")
def update_admin_petty_cash(
    entry_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
):
    pid = _parse_int_id(entry_id, "Entry")
    entry = db.get(PettyCashEntry, pid)
    if entry is None:
        raise not_found("Entry")
    vals = _validate_petty_input(payload)
    for k, v in vals.items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return serialize_petty_entry(entry)


@router.delete("/petty-cash/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_petty_cash(entry_id: str, db: Session = Depends(get_db)):
    pid = _parse_int_id(entry_id, "Entry")
    entry = db.get(PettyCashEntry, pid)
    if entry is None:
        raise not_found("Entry")
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/petty-cash/opening-balance")
def set_admin_opening_balance(payload: dict[str, Any], db: Session = Depends(get_db)):
    try:
        amount = Decimal(str(payload.get("amount"))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except Exception:
        raise invalid("amount", "Enter an amount")
    month = int(payload.get("month") or 0)
    year = int(payload.get("year") or date.today().year)
    if not (1 <= month <= 12):
        raise invalid("month", "Choose a month")
    org = _get_or_create_settings(db)
    org.opening_balance_amount = amount
    org.opening_balance_month = month
    org.opening_balance_year = year
    db.commit()
    return {"amount": float(amount), "month": month, "year": year}


# ---------------- Dashboard & Reports ----------------


def _spend_by_category(
    expenses: list[dict[str, Any]], categories: list[ExpenseCategory]
) -> list[dict[str, Any]]:
    grand = sum(e["total"] for e in expenses)
    name_by_id = {str(c.id): c.name for c in categories}
    buckets: dict[str, dict[str, Any]] = {}
    for e in expenses:
        cid = e["category_id"]
        b = buckets.setdefault(
            cid,
            {"category_id": cid, "name": name_by_id.get(cid, "Unknown"), "total": 0.0, "count": 0},
        )
        b["total"] = round(b["total"] + e["total"], 2)
        b["count"] += 1
    out = [
        {
            **b,
            "percent": round((b["total"] / grand) * 100, 1) if grand > 0 else 0.0,
        }
        for b in buckets.values()
    ]
    out.sort(key=lambda x: x["total"], reverse=True)
    return out


@router.get("/dashboard")
def get_admin_dashboard(
    month: int | None = Query(None),
    year: int | None = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()
    m = month or today.month
    y = year or today.year
    org = _get_or_create_settings(db)
    start_day = org.period_start_day

    all_rows = (
        db.execute(select(Expense).options(*with_relations()).order_by(Expense.id.desc()))
        .scalars()
        .all()
    )
    all_expenses = [serialize_expense(e) for e in all_rows]
    start, end = _period_bounds(y, m, start_day)
    s_iso, e_iso = start.isoformat(), end.isoformat()
    month_expenses = [e for e in all_expenses if s_iso <= e["expense_date"] <= e_iso]

    categories = db.scalars(
        select(ExpenseCategory).order_by(ExpenseCategory.sort_order.asc(), ExpenseCategory.id.asc())
    ).all()
    users = db.scalars(select(User)).all()
    usage = _usage_counts(db)
    pending_rows = db.scalars(
        select(ExpenseItem)
        .where(ExpenseItem.status == ItemStatus.PENDING)
        .order_by(ExpenseItem.id.asc())
    ).all()

    by_category = _spend_by_category(month_expenses, categories)
    individual_total = round(
        sum(e["total"] for e in month_expenses if e["expense_type"] == "individual"), 2
    )
    shared_total = round(
        sum(e["total"] for e in month_expenses if e["expense_type"] == "shared_operational"), 2
    )
    pc = _compute_petty_cash_month(db, m, y)

    monthly_trend: list[dict[str, Any]] = []
    for tm in range(1, 13):
        ts, te = _period_bounds(y, tm, start_day)
        ts_iso, te_iso = ts.isoformat(), te.isoformat()
        t_sum = round(
            sum(e["total"] for e in all_expenses if ts_iso <= e["expense_date"] <= te_iso), 2
        )
        monthly_trend.append({"month": tm, "total": t_sum})

    user_names = {str(u.id): u.full_name for u in users}
    emp_buckets: dict[str, dict[str, Any]] = {}
    for e in month_expenses:
        uid = e["created_by"]
        b = emp_buckets.setdefault(
            uid,
            {"user_id": uid, "full_name": user_names.get(uid, "Unknown"), "total": 0.0, "count": 0},
        )
        b["total"] = round(b["total"] + e["total"], 2)
        b["count"] += 1
    by_employee = sorted(emp_buckets.values(), key=lambda x: x["total"], reverse=True)

    recent_expenses = sorted(
        month_expenses,
        key=lambda e: (e["expense_date"], e["created_at"]),
        reverse=True,
    )[:6]

    return {
        "month": m,
        "year": y,
        "total_spent": round(sum(e["total"] for e in month_expenses), 2),
        "record_count": len(month_expenses),
        "largest_category": by_category[0] if by_category else None,
        "individual_total": individual_total,
        "shared_total": shared_total,
        "petty_cash_balance": pc["summary"]["closing_balance"],
        "active_users": sum(1 for u in users if u.is_active),
        "active_categories": sum(1 for c in categories if c.is_active),
        "pending_items": len(pending_rows),
        "by_category": by_category,
        "monthly_trend": monthly_trend,
        "by_employee": by_employee,
        "recent_expenses": recent_expenses,
        "pending_suggestions": [
            serialize_item(p, int(usage.get(p.id, 0))) for p in pending_rows[:5]
        ],
    }


@router.get("/reports/monthly")
def get_admin_monthly_report(
    month: int | None = Query(None),
    year: int | None = Query(None),
    created_by: str | None = Query(None),
    db: Session = Depends(get_db),
):
    today = date.today()
    m = month or today.month
    y = year or today.year
    org = _get_or_create_settings(db)
    start_day = org.period_start_day
    start, end = _period_bounds(y, m, start_day)
    s_iso, e_iso = start.isoformat(), end.isoformat()

    rows = (
        db.execute(select(Expense).options(*with_relations()).order_by(Expense.expense_date.asc(), Expense.id.asc()))
        .scalars()
        .all()
    )
    all_expenses = [serialize_expense(e) for e in rows]
    if created_by:
        all_expenses = [e for e in all_expenses if e["created_by"] == str(created_by)]
    in_month = [e for e in all_expenses if s_iso <= e["expense_date"] <= e_iso]

    categories = db.scalars(
        select(ExpenseCategory).order_by(ExpenseCategory.sort_order.asc(), ExpenseCategory.id.asc())
    ).all()
    items = db.scalars(select(ExpenseItem).order_by(ExpenseItem.id.asc())).all()
    item_order = {str(it.id): idx for idx, it in enumerate(items)}

    cat_groups: list[dict[str, Any]] = []
    for cat in categories:
        cid = str(cat.id)
        cat_rows = [e for e in in_month if e["category_id"] == cid]
        by_item: dict[str, list[dict[str, Any]]] = {}
        for r in cat_rows:
            key = r["item_id"] or f"title:{r['item_name']}"
            by_item.setdefault(key, []).append(r)
        item_groups = [
            {
                "item_id": iid,
                "item_name": entries[0]["item_name"],
                "entries": sorted(entries, key=lambda x: x["expense_date"]),
                "subtotal": round(sum(x["total"] for x in entries), 2),
            }
            for iid, entries in by_item.items()
        ]
        item_groups.sort(key=lambda g: (item_order.get(g["item_id"], 9999), g["item_name"]))
        cat_groups.append(
            {
                "category_id": cid,
                "name": cat.name,
                "items": item_groups,
                "subtotal": round(sum(x["total"] for x in cat_rows), 2),
            }
        )

    individual_total = round(
        sum(e["total"] for e in in_month if e["expense_type"] == "individual"), 2
    )
    shared_total = round(
        sum(e["total"] for e in in_month if e["expense_type"] == "shared_operational"), 2
    )
    pc = _compute_petty_cash_month(db, m, y)

    return {
        "month": m,
        "year": y,
        "organisation_name": org.organisation_name,
        "currency": org.currency,
        "categories": cat_groups,
        "grand_total": round(sum(e["total"] for e in in_month), 2),
        "record_count": len(in_month),
        "individual_total": individual_total,
        "shared_total": shared_total,
        "petty_cash": pc["summary"],
        "by_category": _spend_by_category(in_month, categories),
    }


@router.get("/reports/annual")
def get_admin_annual_report(
    year: int | None = Query(None),
    db: Session = Depends(get_db),
):
    y = year or date.today().year
    org = _get_or_create_settings(db)
    start_day = org.period_start_day

    rows_db = (
        db.execute(select(Expense).options(*with_relations()).order_by(Expense.id.asc()))
        .scalars()
        .all()
    )
    all_expenses = [serialize_expense(e) for e in rows_db]
    categories = db.scalars(
        select(ExpenseCategory).order_by(ExpenseCategory.sort_order.asc(), ExpenseCategory.id.asc())
    ).all()
    items = db.scalars(
        select(ExpenseItem)
        .where(ExpenseItem.status != ItemStatus.PENDING)
        .order_by(ExpenseItem.id.asc())
    ).all()

    by_month: list[list[dict[str, Any]]] = []
    for m in range(1, 13):
        s, e = _period_bounds(y, m, start_day)
        s_iso, e_iso = s.isoformat(), e.isoformat()
        by_month.append([exp for exp in all_expenses if s_iso <= exp["expense_date"] <= e_iso])

    rows_out: list[dict[str, Any]] = []
    cat_totals: list[dict[str, Any]] = []

    for cat in categories:
        cid = str(cat.id)
        cat_items = [it for it in items if it.category_id == cat.id]
        cat_months = [0.0] * 12
        for it in cat_items:
            iid = str(it.id)
            months = [
                round(sum(exp["total"] for exp in by_month[m_idx] if exp["item_id"] == iid), 2)
                for m_idx in range(12)
            ]
            total = round(sum(months), 2)
            for idx, v in enumerate(months):
                cat_months[idx] = round(cat_months[idx] + v, 2)
            rows_out.append(
                {
                    "category_id": cid,
                    "category_name": cat.name,
                    "item_id": iid,
                    "item_name": it.name,
                    "months": months,
                    "total": total,
                }
            )
        cat_totals.append(
            {
                "category_id": cid,
                "name": cat.name,
                "months": cat_months,
                "total": round(sum(cat_months), 2),
            }
        )

    month_totals = [round(sum(exp["total"] for exp in m_list), 2) for m_list in by_month]
    return {
        "year": y,
        "rows": rows_out,
        "category_totals": cat_totals,
        "month_totals": month_totals,
        "grand_total": round(sum(month_totals), 2),
    }


# ---------------- Import ----------------


@router.post("/import")
def apply_admin_import(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_portal),
):
    counts = {
        "categories_created": 0,
        "items_created": 0,
        "expenses_created": 0,
        "petty_cash_created": 0,
        "skipped_duplicates": 0,
    }

    existing_cats = db.scalars(select(ExpenseCategory)).all()
    cat_by_key = {_name_key(c.name): c for c in existing_cats}
    cat_id_by_name: dict[str, int] = {}

    for c in payload.get("categories") or []:
        c_name = str(c.get("name") or "").strip()
        if not c_name:
            continue
        key = _name_key(c_name)
        cat = cat_by_key.get(key)
        if cat is None:
            max_order = max((x.sort_order or x.id for x in cat_by_key.values()), default=0)
            cat = ExpenseCategory(
                name=c_name,
                description="",
                is_active=True,
                sort_order=int(c.get("sort_order") or (max_order + 1)),
            )
            db.add(cat)
            db.flush()
            cat_by_key[key] = cat
            counts["categories_created"] += 1
        cat_id_by_name[c_name] = cat.id

    existing_items = db.scalars(select(ExpenseItem)).all()
    item_by_cat_and_key = {(it.category_id, _name_key(it.name)): it for it in existing_items}
    item_by_payload_key: dict[str, ExpenseItem] = {}

    for it in payload.get("items") or []:
        cat_name = str(it.get("category") or "")
        cid = cat_id_by_name.get(cat_name)
        if not cid:
            cat_match = cat_by_key.get(_name_key(cat_name))
            cid = cat_match.id if cat_match else None
        if not cid:
            continue
        it_name = re.sub(r"\s+", " ", str(it.get("name") or "").strip())
        if not it_name:
            continue
        lookup = (cid, _name_key(it_name))
        item = item_by_cat_and_key.get(lookup)
        if item is None:
            item = ExpenseItem(
                category_id=cid,
                name=it_name,
                status=ItemStatus.APPROVED,
                suggested_by=None,
            )
            db.add(item)
            db.flush()
            item_by_cat_and_key[lookup] = item
            counts["items_created"] += 1
        item_by_payload_key[str(it.get("key") or "")] = item

    existing_exp_keys = set(
        db.scalars(select(Expense.import_key).where(Expense.import_key.is_not(None))).all()
    )
    for e in payload.get("expenses") or []:
        imp_key = str(e.get("import_key") or "").strip()
        if imp_key and imp_key in existing_exp_keys:
            counts["skipped_duplicates"] += 1
            continue
        item = item_by_payload_key.get(str(e.get("item_key") or ""))
        if item is None:
            continue
        unit_cost = Decimal(str(e.get("unit_cost", 0))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        quantity = Decimal(str(e.get("quantity", 1))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if unit_cost <= 0 or quantity <= 0:
            continue
        amount = (unit_cost * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        exp = Expense(
            category_id=item.category_id,
            item_id=item.id,
            title=item.name,
            unit_cost=unit_cost,
            quantity=quantity,
            amount=amount,
            description=str(e.get("description") or "").strip(),
            expense_date=date.fromisoformat(str(e.get("expense_date"))),
            expense_type=ExpenseType.SHARED_OPERATIONAL,
            created_by=admin.id,
            import_key=imp_key or None,
        )
        db.add(exp)
        if imp_key:
            existing_exp_keys.add(imp_key)
        counts["expenses_created"] += 1

    existing_pc_keys = set(
        db.scalars(
            select(PettyCashEntry.import_key).where(PettyCashEntry.import_key.is_not(None))
        ).all()
    )
    for p in payload.get("petty_cash") or []:
        imp_key = str(p.get("import_key") or "").strip()
        if imp_key and imp_key in existing_pc_keys:
            counts["skipped_duplicates"] += 1
            continue
        amount = Decimal(str(p.get("amount", 0))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        if amount <= 0:
            continue
        raw_type = str(p.get("entry_type") or "cash_out")
        entry = PettyCashEntry(
            entry_type=PettyCashEntryType(raw_type),
            amount=amount,
            entry_date=date.fromisoformat(str(p.get("entry_date"))),
            description=str(p.get("description") or "").strip() or raw_type,
            created_by=admin.id,
            import_key=imp_key or None,
        )
        db.add(entry)
        if imp_key:
            existing_pc_keys.add(imp_key)
        counts["petty_cash_created"] += 1

    ob = payload.get("opening_balance")
    if isinstance(ob, dict) and ob.get("amount") is not None:
        org = _get_or_create_settings(db)
        org.opening_balance_amount = Decimal(str(ob["amount"])).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        org.opening_balance_month = int(ob.get("month") or 1)
        org.opening_balance_year = int(ob.get("year") or 2026)

    db.commit()
    return counts


# ---------------- Settings ----------------


@router.get("/settings")
def get_admin_settings(db: Session = Depends(get_db)):
    org = _get_or_create_settings(db)
    return {
        "organisation_name": org.organisation_name,
        "currency": org.currency,
        "period_start_day": org.period_start_day,
    }


@router.put("/settings")
@router.patch("/settings")
def update_admin_settings(payload: dict[str, Any], db: Session = Depends(get_db)):
    org = _get_or_create_settings(db)
    if "organisation_name" in payload and payload["organisation_name"] is not None:
        name = str(payload["organisation_name"]).strip()
        if not name:
            raise invalid("organisation_name", "Organisation name is required")
        org.organisation_name = name
    if "currency" in payload and payload["currency"] is not None:
        curr = str(payload["currency"]).strip()
        if not re.match(r"^[A-Z]{3}$", curr):
            raise invalid("currency", "Use a 3-letter currency code")
        org.currency = curr
    if "period_start_day" in payload and payload["period_start_day"] is not None:
        try:
            day = round(float(payload["period_start_day"]))
        except (ValueError, TypeError):
            raise invalid("period_start_day", "Choose a day between 1 and 28")
        if not (1 <= day <= 28):
            raise invalid("period_start_day", "Choose a day between 1 and 28")
        org.period_start_day = day
    db.commit()
    db.refresh(org)
    return {
        "organisation_name": org.organisation_name,
        "currency": org.currency,
        "period_start_day": org.period_start_day,
    }

