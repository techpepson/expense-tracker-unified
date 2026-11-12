from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.item import ItemStatus


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    name: str
    status: ItemStatus
    created_at: datetime


class ItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    category_id: int
    name: str = Field(min_length=1, max_length=200)

