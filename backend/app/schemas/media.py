from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class MediaOut(BaseModel):
    id: int
    url: str
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class MediaListOut(BaseModel):
    items: list[MediaOut]
    total: int
    limit: int
    offset: int
