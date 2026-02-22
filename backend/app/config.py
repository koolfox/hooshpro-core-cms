import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MEDIA_DIR = BASE_DIR / "media"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    v = raw.strip().lower()
    return v in ("1", "true", "yes", "y", "on")


@dataclass(frozen=True)
class Settings:
    APP_NAME: str = "Hooshpro API"

    COOKIE_NAME: str = "hooshpro_session"
    SESSION_DAYS: int = 14
    COOKIE_SECURE: bool = _env_bool("HOOSHPRO_COOKIE_SECURE", False)
    COOKIE_SAMESITE: str = os.getenv("HOOSHPRO_COOKIE_SAMESITE", "lax")

    BOOTSTRAP_ENABLED: bool = os.getenv("HOOSHPRO_BOOTSTRAP", "1") == "1"
    BOOTSTRAP_SETUP_KEY: str = os.getenv("HOOSHPRO_SETUP_KEY", "dev-setup-key-123")
    BOOTSTRAP_ALLOW_HOSTS: tuple[str, ...] = ("127.0.0.1", "localhost", "::1")

    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("HOOSHPRO_LOGIN_RATE_WINDOW_SECONDS", "300"))
    LOGIN_RATE_LIMIT_MAX_PER_IP: int = int(os.getenv("HOOSHPRO_LOGIN_RATE_MAX_PER_IP", "20"))
    LOGIN_RATE_LIMIT_MAX_PER_EMAIL: int = int(os.getenv("HOOSHPRO_LOGIN_RATE_MAX_PER_EMAIL", "8"))
    FLOW_TRIGGER_RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("HOOSHPRO_FLOW_TRIGGER_RATE_WINDOW_SECONDS", "60"))
    FLOW_TRIGGER_RATE_LIMIT_MAX_PER_IP: int = int(os.getenv("HOOSHPRO_FLOW_TRIGGER_RATE_MAX_PER_IP", "120"))

    MEDIA_DIR: str = os.getenv("HOOSHPRO_MEDIA_DIR", str(DEFAULT_MEDIA_DIR))
    MAX_UPLOAD_BYTES: int = int(os.getenv("HOOSHPRO_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10MB
    MEDIA_URL_PREFIX: str = "/media"

    # Keep runtime lean by default. Seed data can be applied explicitly via scripts.
    SEED_DEFAULTS_ON_STARTUP: bool = _env_bool("HOOSHPRO_SEED_DEFAULTS_ON_STARTUP", False)


settings = Settings()
