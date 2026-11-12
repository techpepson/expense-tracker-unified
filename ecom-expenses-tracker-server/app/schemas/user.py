from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBrief(BaseModel):
    """Small version of a user, embedded inside other responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    role: UserRole
    can_record_shared: bool
    profile_picture: str | None = None
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = UserRole.EMPLOYEE
    can_record_shared: bool = False


class UserUpdate(BaseModel):
    """Admin edit of an account. Every field is optional (PATCH)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: UserRole | None = None
    can_record_shared: bool | None = None
    is_active: bool | None = None
    # Lets an admin reset a forgotten password.
    password: str | None = Field(default=None, min_length=8, max_length=72)


class ProfileUpdate(BaseModel):
    """Self-service profile update for the logged-in user."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class Token(BaseModel):
    access_token: str
    token: str = ""
    token_type: str = "bearer"
    user: UserOut
