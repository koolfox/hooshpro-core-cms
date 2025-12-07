from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from app.core.config import DB_FILE

sqlite_url=f"sqlite:///{DB_FILE}"

engine=create_engine(
    sqlite_url,
    echo=True,
    connect_args={"check_same_thread":False}
)

def create_db_and_tables()->None:
    SQLModel.metadata.create_all(engine)

def get_session()-> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
