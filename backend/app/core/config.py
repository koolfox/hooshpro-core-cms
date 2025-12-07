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
    "CHANGE_ME_TO_A_RANDOM_LONG_STRING",
)
