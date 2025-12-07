from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class HealthRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
