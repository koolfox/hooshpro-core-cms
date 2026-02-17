import json
import logging
import sys
from pathlib import Path
from time import perf_counter
from urllib.parse import parse_qsl, urlencode
from uuid import uuid4

if sys.version_info < (3, 10):  # pragma: no cover
    raise RuntimeError(
        f"HooshPro backend requires Python 3.10+ (current: {sys.version.split()[0]}).\n"
        "Use the backend venv: `cd backend; .\\.venv\\Scripts\\activate; python -m uvicorn app.main:app --reload`."
    )

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.csrf import CSRFMiddleware
from app.db import init_db
from app.routers import (
    admin,
    auth,
    blocks,
    bootstrap,
    collections,
    components,
    media,
    menus,
    options,
    pages,
    taxonomies,
    templates,
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


_logger = logging.getLogger("hooshpro.api")
if not _logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
_logger.setLevel(logging.INFO)



_SENSITIVE_QUERY_KEYS = {
    "token",
    "access_token",
    "refresh_token",
    "password",
    "secret",
    "api_key",
    "key",
    "code",
    "state",
    "csrf",
    "csrftoken",
    "session",
    "auth",
    "authorization",
    "cookie",
}


def _should_redact_query_key(key: str) -> bool:
    normalized = key.strip().lower()
    if not normalized:
        return False
    if normalized in _SENSITIVE_QUERY_KEYS:
        return True
    return any(
        marker in normalized
        for marker in ("token", "password", "secret", "session", "auth", "csrf", "cookie", "key")
    )


def _safe_query_string(raw_query: str) -> str:
    try:
        pairs = parse_qsl(raw_query, keep_blank_values=True, strict_parsing=False)
    except ValueError:
        return "[unparseable]"

    sanitized: list[tuple[str, str]] = []
    for key, value in pairs:
        if _should_redact_query_key(key):
            sanitized.append((key, "[redacted]"))
            continue
        clipped = value if len(value) <= 256 else f"{value[:256]}..."
        sanitized.append((key, clipped))

    return urlencode(sanitized, doseq=True)

def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        candidate = forwarded_for.split(",", maxsplit=1)[0].strip()
        if candidate:
            return candidate
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    incoming = request.headers.get("x-trace-id") or request.headers.get("x-request-id")
    trace_id = incoming.strip() if isinstance(incoming, str) and incoming.strip() else uuid4().hex
    request.state.trace_id = trace_id

    response = await call_next(request)
    response.headers["x-trace-id"] = trace_id
    return response


def _trace_id(request: Request) -> str | None:
    value = getattr(request.state, "trace_id", None)
    return value if isinstance(value, str) and value else None


@app.middleware("http")
async def request_log(request: Request, call_next):
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((perf_counter() - started) * 1000, 2)
        payload: dict[str, object] = {
            "event": "http.request",
            "method": request.method,
            "path": request.url.path,
            "status": 500,
            "duration_ms": duration_ms,
            "trace_id": _trace_id(request),
            "client_ip": _client_ip(request),
        }
        if request.url.query:
            payload["query"] = _safe_query_string(request.url.query)
        _logger.exception(json.dumps(payload, ensure_ascii=True, sort_keys=True))
        raise

    duration_ms = round((perf_counter() - started) * 1000, 2)
    payload = {
        "event": "http.request",
        "method": request.method,
        "path": request.url.path,
        "status": int(response.status_code),
        "duration_ms": duration_ms,
        "trace_id": _trace_id(request),
        "client_ip": _client_ip(request),
    }
    if request.url.query:
        payload["query"] = _safe_query_string(request.url.query)
    _logger.info(json.dumps(payload, ensure_ascii=True, sort_keys=True))
    return response


def _trace_headers(request: Request) -> dict[str, str]:
    trace_id = _trace_id(request)
    return {"x-trace-id": trace_id} if trace_id else {}


def _error_payload(
    request: Request,
    *,
    error_code: str,
    message: str,
    details: object | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "error_code": error_code,
        "message": message,
        "detail": message,
    }
    trace_id = _trace_id(request)
    if trace_id:
        payload["trace_id"] = trace_id
    if details is not None:
        payload["details"] = details
    return payload


@app.exception_handler(ValueError)
async def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
    message = str(exc) or "Invalid input"
    payload = _error_payload(request, error_code="validation_error", message=message)
    return JSONResponse(status_code=422, content=payload, headers=_trace_headers(request))


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    payload = _error_payload(
        request,
        error_code="validation_error",
        message="Request validation failed.",
        details=exc.errors(),
    )
    return JSONResponse(status_code=422, content=payload, headers=_trace_headers(request))


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    status_code = int(exc.status_code)
    code_map = {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_error",
        429: "rate_limited",
    }
    error_code = code_map.get(status_code, "http_error")

    details = exc.detail
    if isinstance(details, str):
        message = details
        details_obj: object | None = None
    elif details is None:
        message = "Request failed."
        details_obj = None
    else:
        message = "Request failed."
        details_obj = details

    payload = _error_payload(
        request,
        error_code=error_code,
        message=message,
        details=details_obj,
    )
    return JSONResponse(status_code=status_code, content=payload, headers=_trace_headers(request))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, _: Exception) -> JSONResponse:
    payload = _error_payload(
        request,
        error_code="internal_error",
        message="Internal server error.",
    )
    return JSONResponse(status_code=500, content=payload, headers=_trace_headers(request))


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(admin.router)
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
