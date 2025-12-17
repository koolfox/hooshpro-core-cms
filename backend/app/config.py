import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MEDIA_DIR = BASE_DIR / "media"


@dataclass(frozen=True)
class Settings:
    APP_NAME: str = "Hooshpro API"

    COOKIE_NAME: str = "hooshpro_session"
    SESSION_DAYS: int = 14
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    BOOTSTRAP_ENABLED: bool = os.getenv("HOOSHPRO_BOOTSTRAP", "1") == "1"
    BOOTSTRAP_SETUP_KEY: str = os.getenv("HOOSHPRO_SETUP_KEY", "dev-setup-key-123")
    BOOTSTRAP_ALLOW_HOSTS: tuple[str, ...] = ("127.0.0.1", "localhost", "::1")

    MEDIA_DIR: str = os.getenv("HOOSHPRO_MEDIA_DIR", str(DEFAULT_MEDIA_DIR))
    MAX_UPLOAD_BYTES: int = int(os.getenv("HOOSHPRO_MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))  # 10MB
    MEDIA_URL_PREFIX: str = "/media"


settings = Settings()
