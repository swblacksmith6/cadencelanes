from pydantic import BaseModel, Field


class CoachCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=10, max_length=15)


class CoachUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
