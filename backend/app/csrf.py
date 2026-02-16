from __future__ import annotations

import secrets
from typing import Callable, Iterable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

CSRF_COOKIE = "csrftoken"
CSRF_HEADER = "X-CSRF-Token"


def new_csrf_token() -> str:
    # 32 bytes urlsafe -> ~43 chars
    return secrets.token_urlsafe(32)


class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, unsafe_paths_exempt: Iterable[str] = ()):
        super().__init__(app)
        self.exempt = tuple(unsafe_paths_exempt)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            path = request.url.path
            if not any(path.startswith(p) for p in self.exempt):
                auth = (request.headers.get("authorization") or "").strip().lower()
                if auth.startswith("bearer "):
                    return await call_next(request)

                # Only enforce CSRF for cookie-based session requests.
                session_cookie = request.cookies.get(settings.COOKIE_NAME)
                if session_cookie:
                    cookie_token = request.cookies.get(CSRF_COOKIE)
                    header_token = request.headers.get(CSRF_HEADER)
                    if not cookie_token or not header_token or cookie_token != header_token:
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "CSRF token missing or invalid"},
                        )
        return await call_next(request)


def set_csrf_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=CSRF_COOKIE,
        value=token,
        httponly=False,  # double-submit: must be readable by frontend
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=settings.SESSION_DAYS * 24 * 3600,
        path="/",
    )
