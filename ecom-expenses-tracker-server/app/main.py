from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import get_db
from app.routers import admin, auth, categories, expenses, items, petty_cash, profile, reports, users
from app.routers.admin import AdminError

settings = get_settings()

app = FastAPI(
    title="e-Com Services Expense Tracker API",
    version="0.1.0",
    description="Internal API for recording company expenses and producing monthly reports.",
)


@app.exception_handler(AdminError)
async def handle_admin_error(_request: Request, exc: AdminError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "message": exc.message,
            "code": exc.code,
            "errors": exc.errors,
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the React app read the file name when downloading reports.
    expose_headers=["Content-Disposition"],
)

api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(profile.router)
api.include_router(users.router)
api.include_router(categories.router)
api.include_router(items.router)
api.include_router(expenses.router)
api.include_router(petty_cash.router)
api.include_router(reports.router)
api.include_router(admin.router)


@api.get("/health", tags=["System"])
def health(db: Session = Depends(get_db)):
    """Confirms the API is up and can reach PostgreSQL."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


app.include_router(api)
