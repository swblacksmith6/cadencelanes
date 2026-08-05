import re
from datetime import date

from pydantic import BaseModel, Field, field_validator


class SessionCreate(BaseModel):
    session_date: date
    # "morning" and "evening" are the standard slots, but any custom type is
    # allowed (e.g. "competition"). One session per (date, type).
    session_type: str = Field(min_length=1, max_length=30)
    notes: str | None = None

    @field_validator("session_type")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9 _-]*", v):
            raise ValueError("session_type must contain only letters, numbers, spaces, - or _")
        return v
