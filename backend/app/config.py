import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    APP_NAME: str = "Hooshpro API"

    COOKIE_NAME: str = "hooshpro_session"
    SESSION_DAYS: int = 14
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    # --- bootstrap admin endpoint ---
    BOOTSTRAP_ENABLED: bool = os.getenv("HOOSHPRO_BOOTSTRAP", "1") == "1"
    BOOTSTRAP_SETUP_KEY: str = os.getenv("HOOSHPRO_SETUP_KEY", "dev-setup-key-123")
    BOOTSTRAP_ALLOW_HOSTS: tuple[str, ...] = ("127.0.0.1", "localhost", "::1")

settings = Settings()
