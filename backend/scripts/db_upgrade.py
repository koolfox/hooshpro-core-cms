from __future__ import annotations

import os
from alembic import command
from alembic.config import Config

HERE = os.path.abspath(os.path.dirname(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))

def main() -> None:
    cfg = Config(os.path.join(BACKEND_ROOT, "alembic.ini"))
    command.upgrade(cfg, "head")

if __name__ == "__main__":
    main()
