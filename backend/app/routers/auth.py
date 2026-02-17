from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session as OrmSession

from app.config import settings
from app.core.rate_limit import SlidingWindowRateLimiter
from app.csrf import CSRF_HEADER, new_csrf_token, set_csrf_cookie
from app.db_session import get_db
from app.deps import get_current_user
from app.models import User, UserSession
from app.security import hash_session_token, new_session_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


login_ip_limiter = SlidingWindowRateLimiter(
    limit=settings.LOGIN_RATE_LIMIT_MAX_PER_IP,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
)
login_email_limiter = SlidingWindowRateLimiter(
    limit=settings.LOGIN_RATE_LIMIT_MAX_PER_EMAIL,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    id: int
    email: EmailStr


class CsrfOut(BaseModel):
    csrf_token: str


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        candidate = forwarded_for.split(",", maxsplit=1)[0].strip()
        if candidate:
            return candidate
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_login_rate_limit(request: Request, email: str) -> tuple[str, str]:
    ip_key = _client_ip(request)
    email_key = email.lower()

    limited_ip, retry_ip = login_ip_limiter.is_limited(ip_key)
    limited_email, retry_email = login_email_limiter.is_limited(email_key)
    if not limited_ip and not limited_email:
        return ip_key, email_key

    retry_after = max(retry_ip, retry_email, 1)
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many login attempts. Please try again later.",
        headers={"Retry-After": str(retry_after)},
    )


def _record_login_failure(ip_key: str, email_key: str) -> None:
    login_ip_limiter.hit(ip_key)
    login_email_limiter.hit(email_key)


def _clear_login_failures(ip_key: str, email_key: str) -> None:
    login_ip_limiter.reset(ip_key)
    login_email_limiter.reset(email_key)


def _set_new_csrf(response: Response) -> str:
    csrf_token = new_csrf_token()
    set_csrf_cookie(response, csrf_token)
    response.headers[CSRF_HEADER] = csrf_token
    return csrf_token


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        max_age=settings.SESSION_DAYS * 24 * 3600,
        path="/",
    )


def create_session(db: OrmSession, user_id: int) -> str:
    raw = new_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.SESSION_DAYS)

    sess = UserSession(
        user_id=user_id,
        token_hash=hash_session_token(raw),
        expires_at=expires_at,
    )
    db.add(sess)
    db.commit()
    return raw


@router.get("/csrf", response_model=CsrfOut)
def csrf(response: Response):
    return CsrfOut(csrf_token=_set_new_csrf(response))


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, request: Request, response: Response, db: OrmSession = Depends(get_db)):
    email = payload.email.strip().lower()
    ip_key, email_key = _enforce_login_rate_limit(request, email)

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(user.password_hash, payload.password):
        _record_login_failure(ip_key, email_key)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _clear_login_failures(ip_key, email_key)

    raw = create_session(db, user.id)
    set_session_cookie(response, raw)

    _set_new_csrf(response)

    return MeOut(id=user.id, email=user.email)


@router.post("/logout")
def logout(response: Response, request: Request, db: OrmSession = Depends(get_db)):
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        db.query(UserSession).filter(UserSession.token_hash == hash_session_token(token)).delete()
        db.commit()

    response.delete_cookie(settings.COOKIE_NAME, path="/")
    response.delete_cookie("csrftoken", path="/")
    return {"ok": True}


@router.get("/me", response_model=MeOut)
def me(request: Request, response: Response, user: User = Depends(get_current_user)):
    # Ensure long-lived sessions created before CSRF rollout receive a token cookie.
    if not request.cookies.get("csrftoken"):
        _set_new_csrf(response)
    return MeOut(id=user.id, email=user.email)


@router.post("/token")
def token(
    form: OAuth2PasswordRequestForm = Depends(),
    db: OrmSession = Depends(get_db),
):
    email = form.username.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(user.password_hash, form.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    raw = create_session(db, user.id)
    return {"access_token": raw, "token_type": "bearer"}
