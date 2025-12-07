from pathlib import Path
import os
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_FILE =os.environ.get(
    "HOOSHPRO_DB_FILE",
    str(DATA_DIR/"hooshpro.db"),
)

SECRET_KEY=os.environ.get(
    "HOOSHPRO_SECRET_KEY",
    "79f952a29442065772617f7d8958bdaf9cd0461aeb002369ec4683a668f49ac5",
)


JWT_ALGORITHM ="HS256"

ACCESS_TOKEN_EXPIRE_MINUTES=int(os.environ.get("HOOSHPRO_ACCESS_TOKEN_EXPIRE_MINUTES","60"))
