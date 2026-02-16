from __future__ import annotations

from typing import Generator

from sqlalchemy.orm import Session as OrmSession

# Re-use the engine/session factory defined in app.db (keeps migrations + seeding centralized)
from app.db import SessionLocal  # type: ignore


def get_db() -> Generator[OrmSession, None, None]:
    """
    Yield a SQLAlchemy session for FastAPI dependencies.
    Lives in a dedicated module to keep db bootstrap/seeding concerns out of routers.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
