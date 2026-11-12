from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import ExpenseCategory, ExpenseItem, ItemStatus, User
from app.schemas.item import ItemCreate, ItemOut

router = APIRouter(prefix="/items", tags=["Items"])


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=list[ItemOut])
def list_items(
    category_id: int | None = Query(None),
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(ExpenseItem).order_by(ExpenseItem.name)
    if category_id is not None:
        stmt = stmt.where(ExpenseItem.category_id == category_id)
    if search:
        pattern = f"%{_escape_like(search.strip())}%"
        stmt = stmt.where(ExpenseItem.name.ilike(pattern, escape="\\"))
    return db.scalars(stmt).all()


@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_or_suggest_item(
    data: ItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    category = db.get(ExpenseCategory, data.category_id)
    if category is None or not category.is_active:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Category does not exist or is inactive"
        )

    existing = db.scalar(
        select(ExpenseItem).where(
            ExpenseItem.category_id == data.category_id,
            func.lower(ExpenseItem.name) == data.name.lower(),
        )
    )
    if existing is not None:
        return existing

    item = ExpenseItem(
        category_id=data.category_id,
        name=data.name,
        status=ItemStatus.APPROVED if user.is_admin else ItemStatus.PENDING,
        suggested_by=None if user.is_admin else user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

