from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import OrganisationSettings, PettyCashEntry, PettyCashEntryType, User
from app.schemas.petty_cash import (
    PettyCashEntryCreate,
    PettyCashEntryOut,
    PettyCashEntryUpdate,
    PettyCashSummaryOut,
)
from app.services.periods import month_bounds

ZERO = Decimal("0.00")


def _check_can_record_petty_cash(user: User) -> None:
    if not (user.is_admin or user.can_record_shared):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "You are not authorised to modify petty cash entries",
        )


def get_petty_cash_summary(db: Session, year: int, month: int) -> PettyCashSummaryOut:
    start, end = month_bounds(year, month)

    org = db.scalar(select(OrganisationSettings).limit(1))
    anchor_opening = ZERO
    if (
        org is not None
        and org.opening_balance_amount is not None
        and org.opening_balance_year is not None
        and org.opening_balance_month is not None
        and (year, month) >= (org.opening_balance_year, org.opening_balance_month)
    ):
        anchor_opening = Decimal(org.opening_balance_amount)

    # Calculate opening balance from all entries strictly prior to `start`
    prior_totals = dict(
        db.execute(
            select(PettyCashEntry.entry_type, func.coalesce(func.sum(PettyCashEntry.amount), 0))
            .where(PettyCashEntry.entry_date < start)
            .group_by(PettyCashEntry.entry_type)
        ).all()
    )
    prior_in = Decimal(prior_totals.get(PettyCashEntryType.CASH_IN, ZERO))
    prior_out = Decimal(prior_totals.get(PettyCashEntryType.CASH_OUT, ZERO))
    prior_charge = Decimal(prior_totals.get(PettyCashEntryType.CHARGE, ZERO))
    opening_balance = (anchor_opening + prior_in - prior_out - prior_charge).quantize(Decimal("0.01"))

    entries = (
        db.execute(
            select(PettyCashEntry)
            .options(joinedload(PettyCashEntry.creator))
            .where(PettyCashEntry.entry_date >= start, PettyCashEntry.entry_date <= end)
            .order_by(PettyCashEntry.entry_date.desc(), PettyCashEntry.id.desc())
        )
        .scalars()
        .all()
    )

    cash_in = sum((e.amount for e in entries if e.entry_type == PettyCashEntryType.CASH_IN), ZERO)
    cash_used = sum((e.amount for e in entries if e.entry_type == PettyCashEntryType.CASH_OUT), ZERO)
    charges = sum((e.amount for e in entries if e.entry_type == PettyCashEntryType.CHARGE), ZERO)
    cash_out_total = cash_used + charges
    closing_balance = opening_balance + cash_in - cash_out_total

    return PettyCashSummaryOut(
        opening_balance=opening_balance,
        cash_in=cash_in,
        cash_out_total=cash_out_total,
        charges=charges,
        closing_balance=closing_balance,
        cash_used=cash_used,
        entries=[PettyCashEntryOut.model_validate(e) for e in entries],
    )


def get_entry_or_404(db: Session, entry_id: int) -> PettyCashEntry:
    entry = db.execute(
        select(PettyCashEntry)
        .options(joinedload(PettyCashEntry.creator))
        .where(PettyCashEntry.id == entry_id)
    ).scalar_one_or_none()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Petty cash entry not found")
    return entry


def create_petty_cash_entry(
    db: Session, user: User, data: PettyCashEntryCreate
) -> PettyCashEntry:
    _check_can_record_petty_cash(user)
    entry = PettyCashEntry(**data.model_dump(), created_by=user.id)
    db.add(entry)
    db.commit()
    return get_entry_or_404(db, entry.id)


def update_petty_cash_entry(
    db: Session, user: User, entry_id: int, data: PettyCashEntryUpdate
) -> PettyCashEntry:
    _check_can_record_petty_cash(user)
    entry = get_entry_or_404(db, entry_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(entry, field, value)
    db.commit()
    db.expire_all()
    return get_entry_or_404(db, entry_id)


def delete_petty_cash_entry(db: Session, user: User, entry_id: int) -> None:
    _check_can_record_petty_cash(user)
    entry = get_entry_or_404(db, entry_id)
    db.delete(entry)
    db.commit()

