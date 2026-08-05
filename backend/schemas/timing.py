from pydantic import BaseModel, Field


class TimingCreate(BaseModel):
    session_id: str
    student_id: str
    swim_style_id: str
    distance_event_id: str
    time_seconds: float = Field(gt=0)
    notes: str | None = None


class TimingUpdate(BaseModel):
    time_seconds: float | None = Field(default=None, gt=0)
    notes: str | None = None
