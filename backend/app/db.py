from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.config import DB_FILE
from app.seed.bootstrap import seed_defaults as run_seed_defaults

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"
ALEMBIC_BASELINE_REVISION = "79769d50d480"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _path_points_to_backend_root(path_entry: str, backend_root: Path) -> bool:
    candidate = path_entry or os.getcwd()
    try:
        return Path(candidate).resolve() == backend_root
    except Exception:
        return False


def _require_alembic() -> tuple[object, type, type]:
    try:
        backend_root = Path(__file__).resolve().parent.parent
        original_sys_path = list(sys.path)
        try:
            sys.path = [
                entry for entry in sys.path if not _path_points_to_backend_root(entry, backend_root)
            ]
            from alembic import command as alembic_command  # type: ignore
            from alembic.config import Config as AlembicConfig  # type: ignore
            from alembic.script import ScriptDirectory  # type: ignore
        finally:
            sys.path = original_sys_path
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Alembic is required to run migrations.\n"
            "If you see this while running `uvicorn`, you're likely not using the backend venv.\n"
            "Fix: `cd backend; .\\.venv\\Scripts\\activate; python -m uvicorn app.main:app --reload`\n"
            "Or install deps: `pip install -r backend/requirements.txt`."
        ) from exc

    return alembic_command, AlembicConfig, ScriptDirectory


def _alembic_config() -> object:
    _, AlembicConfig, _ = _require_alembic()
    backend_root = Path(__file__).resolve().parent.parent
    cfg = AlembicConfig(str(backend_root / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", SQLALCHEMY_DATABASE_URL)
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    return cfg


def run_migrations() -> None:
    command, _, ScriptDirectory = _require_alembic()
    cfg = _alembic_config()

    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    known_tables = {
        "users",
        "sessions",
        "pages",
        "page_templates",
        "components",
        "blocks",
        "media_assets",
        "media_folders",
        "menus",
        "menu_items",
        "content_types",
        "content_fields",
        "content_entries",
        "options",
        "themes",
        "taxonomies",
        "terms",
        "term_relationships",
        "workflows",
        "workflow_runs",
    }
    baseline_tables = {"users", "sessions", "pages"}

    if "alembic_version" not in tables and tables.intersection(known_tables):
        has_non_baseline = bool(tables.intersection(known_tables - baseline_tables))
        if has_non_baseline:
            head = ScriptDirectory.from_config(cfg).get_current_head()
            if not head:
                raise RuntimeError("Alembic head revision not found")
            command.stamp(cfg, head)
        else:
            command.stamp(cfg, ALEMBIC_BASELINE_REVISION)

    command.upgrade(cfg, "head")


def init_db() -> None:
    run_migrations()
    if settings.SEED_DEFAULTS_ON_STARTUP:
        run_seed_defaults(engine, SessionLocal)


# NOTE: get_db moved to app.db_session to keep router deps separate from bootstrap logic.
