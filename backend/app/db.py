from __future__ import annotations

from pathlib import Path
from typing import Generator
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker, Session as OrmSession

from app.core.config import DB_FILE

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
ALEMBIC_BASELINE_REVISION = "79769d50d480"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def _alembic_config() -> Config:
    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    return cfg


def run_migrations() -> None:
    cfg = _alembic_config()

    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    if "alembic_version" not in tables and tables.intersection(
        {"users", "sessions", "pages", "media_assets"}
    ):
        command.stamp(cfg, ALEMBIC_BASELINE_REVISION)

    command.upgrade(cfg, "head")


def init_db() -> None:
    run_migrations()


def get_db() -> Generator[OrmSession, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
