import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine
from sqlmodel import Session
from app import models
from app.routers import auth as auth_router
from app.routers.pages import admin_router, public_router
from app.routers import bootstrap as bootstrap_router


app = FastAPI(title="Hoosh Pro API",swagger_ui_parameters={
    "withCredentials":True,
    "persistAuthorization": True,
})

origins=["http://127.0.0.1:3000","http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.on_event("startup")
def on_startup():
    models.Base.metadata.create_all(bind=engine)

@app.get("/api/debug/db")
def debug_db():
    insp = inspect(engine)
    return {
        "cwd": os.getcwd(),
        "db_url": str(engine.url),
        "tables": insp.get_table_names(),
    }

@app.get("/api/health")
async def health():
    return {"status":"ok"}

app.include_router(auth_router.router)
app.include_router(admin_router)
app.include_router(public_router)
app.include_router(bootstrap_router.router)

from fastapi import Depends
from sqlmodel import Session
from app.db import get_session, engine
from sqlalchemy import text, inspect

@app.get("/debug/tables")
def list_tables(session:Session=Depends(get_session)):
    rows=session.exec(text("SELECT name FROM sqlite_master WHERE type='table';")).all()
    table_names=[row[0] for row in rows]
    return {"tables": table_names}

@app.get("/debug/tables2")
def list_tables2(session:Session=Depends(get_session)):
    insp=inspect(engine)
    table_names=insp.get_table_names()
    return {"tables":table_names}
