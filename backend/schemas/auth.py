from pydantic import BaseModel, Field


class OTPRequest(BaseModel):
    phone: str = Field(min_length=10, max_length=15)


class OTPVerify(BaseModel):
    phone: str = Field(min_length=10, max_length=15)
    code: str = Field(min_length=4, max_length=8)


class UserOut(BaseModel):
    id: str
    name: str
    role: str
    club_id: str | None = None
    club_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    other_sessions_ended: bool = False
    user: UserOut
