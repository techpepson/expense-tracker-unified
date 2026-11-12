from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import User
from app.schemas.report import AnnualReport, MonthlyReport
from app.services import exports
from app.services.reports import build_annual_report, build_monthly_report

router = APIRouter(prefix="/reports", tags=["Reports"])

PDF_TYPE = "application/pdf"
XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/monthly", response_model=MonthlyReport)
def monthly_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return build_monthly_report(db, year, month)


@router.get("/annual", response_model=AnnualReport)
def annual_report(
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return build_annual_report(db, year)


@router.get("/monthly/export/pdf")
def export_pdf(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    report = build_monthly_report(db, year, month)
    return Response(
        content=exports.build_pdf(report),
        media_type=PDF_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{exports.export_filename(report, "pdf")}"'},
    )


@router.get("/monthly/export/excel")
def export_excel(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    report = build_monthly_report(db, year, month)
    return Response(
        content=exports.build_excel(report),
        media_type=XLSX_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{exports.export_filename(report, "xlsx")}"'},
    )
