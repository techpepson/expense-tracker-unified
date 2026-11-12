import base64

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas.user import ChangePassword, ProfileUpdate, UserBrief, UserOut

router = APIRouter(tags=["Profile"])


@router.put("/me", response_model=UserOut)
@router.patch("/me", response_model=UserOut)
def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changes = data.model_dump(exclude_unset=True)
    if "email" in changes and changes["email"] is not None:
        new_email = changes["email"].lower()
        existing = db.scalar(
            select(User.id).where(User.email == new_email, User.id != current_user.id)
        )
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")
        current_user.email = new_email
    if "full_name" in changes and changes["full_name"] is not None:
        current_user.full_name = changes["full_name"]
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_my_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile | None = File(None),
    avatar: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    upload = file or avatar
    if upload is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose an image file")
    content = await upload.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image file is too large (max 5MB)")
    mime = upload.content_type or "image/png"
    encoded = base64.b64encode(content).decode("ascii")
    current_user.profile_picture = f"data:{mime};base64,{encoded}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users/lookup", response_model=list[UserBrief])
def users_lookup(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.full_name)
    ).all()

