from datetime import date

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.petty_cash import (
    PettyCashEntryCreate,
    PettyCashEntryOut,
    PettyCashEntryUpdate,
    PettyCashSummaryOut,
)
from app.services import petty_cash as service

router = APIRouter(prefix="/petty-cash", tags=["Petty Cash"])


@router.get("", response_model=PettyCashSummaryOut)
def get_petty_cash(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(default_factory=lambda: date.today().year, ge=2000, le=2100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return service.get_petty_cash_summary(db, year, month)


@router.post("/entries", response_model=PettyCashEntryOut, status_code=status.HTTP_201_CREATED)
def create_entry(
    data: PettyCashEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.create_petty_cash_entry(db, user, data)


@router.put("/entries/{entry_id}", response_model=PettyCashEntryOut)
@router.patch("/entries/{entry_id}", response_model=PettyCashEntryOut)
def update_entry(
    entry_id: int,
    data: PettyCashEntryUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.update_petty_cash_entry(db, user, entry_id, data)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    service.delete_petty_cash_entry(db, user, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

