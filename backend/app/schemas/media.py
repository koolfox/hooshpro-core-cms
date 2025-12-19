from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MediaOut(BaseModel):
    id: int
    url: str
    folder_id: Optional[int] = None
    original_name: str
    content_type: str
    size_bytes: int
    created_at: datetime


class MediaListOut(BaseModel):
    items: list[MediaOut]
    total: int
    limit: int
    offset: int


class MediaMove(BaseModel):
    folder_id: int = 0


class MediaFolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class MediaFolderUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None


class MediaFolderOut(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class MediaFolderListOut(BaseModel):
    items: list[MediaFolderOut]
