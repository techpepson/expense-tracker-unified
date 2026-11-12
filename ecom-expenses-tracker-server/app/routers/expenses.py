from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import ExpenseType, User
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpensePage, ExpenseUpdate
from app.services import expenses as service

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.get("", response_model=ExpensePage)
def list_expenses(
    year: int | None = Query(None, ge=2000, le=2100),
    month: int | None = Query(None, ge=1, le=12, description="Requires year"),
    category_id: int | None = None,
    item_id: int | None = None,
    expense_type: ExpenseType | None = None,
    created_by: int | None = Query(None, description="Only expenses recorded by this user id"),
    q: str | None = Query(None, max_length=100, description="Search in title and description"),
    search: str | None = Query(None, max_length=100, description="Alias for q"),
    sort_by: Literal["expense_date", "amount", "created_at", "title"] = "expense_date",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    limit: int | None = Query(None, ge=1, le=500, description="Alias for page_size"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    effective_q = q if q is not None else search
    effective_page_size = limit if limit is not None else page_size
    conditions = service.build_conditions(
        year=year,
        month=month,
        category_id=category_id,
        item_id=item_id,
        expense_type=expense_type,
        created_by=created_by,
        q=effective_q,
    )
    return service.list_expenses(db, conditions, sort_by, order, page, effective_page_size)


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.create_expense(db, user, data)


@router.post("/bulk", response_model=list[ExpenseOut], status_code=status.HTTP_201_CREATED)
def create_expenses_bulk(
    data: list[ExpenseCreate], db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return service.create_expenses_bulk(db, user, data)


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return service.get_expense_or_404(db, expense_id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int, data: ExpenseUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return service.update_expense(db, user, expense_id, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    service.delete_expense(db, user, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
