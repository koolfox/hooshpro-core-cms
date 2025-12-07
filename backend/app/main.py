from fastapi import FastAPI
from app.db import create_db_and_tables

app = FastAPI(title="Hoosh Pro API")

@app.on_event("startup")
async def on_startup()-> None:
    create_db_and_tables()

@app.get("/health")
async def health():
    return {"status":"ok"}
