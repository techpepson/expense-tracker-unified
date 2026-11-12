from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.database import get_db
from app.models import ExpenseCategory, User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["Categories"])


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(ExpenseCategory.id).where(func.lower(ExpenseCategory.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(ExpenseCategory.id != exclude_id)
    return db.scalar(stmt) is not None


@router.get("", response_model=list[CategoryOut])
def list_categories(
    include_inactive: bool = Query(False, description="Admins only"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(ExpenseCategory).order_by(ExpenseCategory.name)
    if not (include_inactive and user.is_admin):
        stmt = stmt.where(ExpenseCategory.is_active.is_(True))
    return db.scalars(stmt).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_category(data: CategoryCreate, db: Session = Depends(get_db)):
    if _name_taken(db, data.name):
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists")
    category = ExpenseCategory(**data.model_dump())
    db.add(category)
    db.commit()
    return category


@router.patch("/{category_id}", response_model=CategoryOut, dependencies=[Depends(require_admin)])
def update_category(category_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    category = db.get(ExpenseCategory, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name") is None:
        changes.pop("name", None)
    if changes.get("is_active") is None:
        changes.pop("is_active", None)
    if "name" in changes and _name_taken(db, changes["name"], exclude_id=category_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists")
    for field, value in changes.items():
        setattr(category, field, value)
    db.commit()
    return category
