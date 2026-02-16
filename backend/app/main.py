import sys

if sys.version_info < (3, 10):  # pragma: no cover
    raise RuntimeError(
        f"HooshPro backend requires Python 3.10+ (current: {sys.version.split()[0]}).\n"
        "Use the backend venv: `cd backend; .\\.venv\\Scripts\\activate; python -m uvicorn app.main:app --reload`."
    )

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.csrf import CSRFMiddleware
from app.routers import (
    auth,
    bootstrap,
    pages,
    media,
    components,
    blocks,
    templates,
    menus,
    collections,
    options,
    taxonomies,
    themes,
)

app = FastAPI(title=settings.APP_NAME)

origins = ["http://127.0.0.1:3000", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CSRF protection for unsafe methods; login/token endpoints are exempt to allow obtaining tokens.
app.add_middleware(
    CSRFMiddleware,
    unsafe_paths_exempt=(
        "/api/auth/login",
        "/api/auth/token",
    ),
)

Path(settings.MEDIA_DIR).mkdir(parents=True, exist_ok=True)
app.mount(settings.MEDIA_URL_PREFIX, StaticFiles(directory=settings.MEDIA_DIR), name="media")


@app.exception_handler(ValueError)
async def handle_value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc) or "Invalid input"})


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(bootstrap.router)
app.include_router(auth.router)
app.include_router(pages.router)
app.include_router(media.router)
app.include_router(components.router)
app.include_router(blocks.router)
app.include_router(templates.router)
app.include_router(menus.router)
app.include_router(collections.router)
app.include_router(options.router)
app.include_router(taxonomies.router)
app.include_router(themes.router)

