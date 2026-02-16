from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

OPTION_KEY_RE = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")


def validate_option_key(key: str) -> str:
    s = (key or "").strip().lower()
    if not s:
        raise ValueError("Option key is required")
    if len(s) > 200:
        raise ValueError("Option key is too long (max 200)")
    if not OPTION_KEY_RE.match(s):
        raise ValueError("Option key must be lowercase letters/numbers with separators (., _, -)")
    return s


class OptionSetIn(BaseModel):
    value: Any = Field(default=None)


class OptionOut(BaseModel):
    id: int
    key: str
    value: Any = None
    created_at: datetime
    updated_at: datetime


class OptionListOut(BaseModel):
    items: list[OptionOut]
    total: int
    limit: int
    offset: int


class PublicOptionsOut(BaseModel):
    options: dict[str, Any] = Field(default_factory=dict)

