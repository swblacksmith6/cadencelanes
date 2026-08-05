from typing import Literal

from pydantic import BaseModel, Field


class AttendanceItem(BaseModel):
    student_id: str
    status: Literal["present", "absent"]


class AttendanceUpdate(BaseModel):
    updates: list[AttendanceItem] = Field(min_length=1)
