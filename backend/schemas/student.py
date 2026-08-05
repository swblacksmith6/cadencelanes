from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ParentContactIn(BaseModel):
    relation: Literal["father", "mother", "guardian"]
    name: str | None = None
    phone: str = Field(min_length=10, max_length=15)
    is_primary: bool = False


class StudentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    date_of_birth: date
    address: str | None = None
    parent_contacts: list[ParentContactIn] = Field(min_length=1, max_length=2)

    @field_validator("date_of_birth")
    @classmethod
    def dob_in_past(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("date_of_birth must be in the past")
        return v

    @model_validator(mode="after")
    def exactly_one_primary(self):
        if sum(1 for c in self.parent_contacts if c.is_primary) != 1:
            raise ValueError("exactly one parent contact must be primary")
        return self


class StudentUpdate(BaseModel):
    name: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    is_active: bool | None = None
    parent_contacts: list[ParentContactIn] | None = Field(default=None, min_length=1, max_length=2)

    @model_validator(mode="after")
    def exactly_one_primary(self):
        if self.parent_contacts is not None:
            if sum(1 for c in self.parent_contacts if c.is_primary) != 1:
                raise ValueError("exactly one parent contact must be primary")
        return self


class NoteCreate(BaseModel):
    note: str = Field(min_length=1)
    category: Literal["general", "technique", "fitness", "behavior", "goal"] = "general"


class AssessmentCreate(BaseModel):
    swim_style_id: str
    rating: int = Field(ge=1, le=5)
    notes: str | None = None
