from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import DUMMY_HASH, create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas.user import ChangePassword, Token, UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(request: Request, db: Session = Depends(get_db)):
    """Log in with either form fields (`username`/`email` + `password`) or JSON (`email` + `password`)."""
    content_type = request.headers.get("content-type", "")
    portal = request.headers.get("x-client-app", "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}
        raw_email = body.get("email") or body.get("username") or ""
        raw_password = body.get("password") or ""
        if body.get("portal"):
            portal = str(body.get("portal")).lower()
    else:
        form = await request.form()
        raw_email = form.get("username") or form.get("email") or ""
        raw_password = form.get("password") or ""

    email = str(raw_email).strip().lower()
    password = str(raw_password)
    if not email or not password:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Email and password are required")

    user = db.scalar(select(User).where(User.email == email))
    # Always run a bcrypt check so response time does not reveal whether the email exists.
    password_ok = verify_password(password, user.password_hash if user else DUMMY_HASH)
    if user is None or not password_ok:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if portal == "admin" and not user.is_admin:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "Employee accounts sign in on the employee site",
                "message": "Employee accounts sign in on the employee site",
                "code": "employee_account",
            },
        )
    if not user.is_active:
        if portal == "admin":
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "detail": "This account has been deactivated",
                    "message": "This account has been deactivated",
                    "code": "account_inactive",
                },
            )
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    token = create_access_token(user.id)
    return {"access_token": token, "token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def me(request: Request, current_user: User = Depends(get_current_user)):
    if request.headers.get("x-client-app", "").lower() == "admin" and not current_user.is_admin:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "Employee accounts sign in on the employee site",
                "message": "Employee accounts sign in on the employee site",
                "code": "employee_account",
            },
        )
    return current_user


@router.post("/logout")
def logout():
    return {"ok": True}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePassword, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
