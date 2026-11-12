import enum
from typing import Type

from sqlalchemy import Enum


def string_enum(enum_cls: Type[enum.Enum], length: int = 30) -> Enum:
    """Store a Python enum as plain text (its value) instead of a native PostgreSQL ENUM.

    Native ENUMs are awkward to change later with migrations; text columns are not.
    """
    return Enum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda e: [member.value for member in e],
        validate_strings=True,
    )
