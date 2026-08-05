from pydantic import BaseModel, Field


class ClubRegister(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    head_coach_name: str = Field(min_length=1, max_length=200)
    head_coach_phone: str = Field(min_length=10, max_length=15)


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1)
