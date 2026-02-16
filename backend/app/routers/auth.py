from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session as OrmSession

from app.config import settings
from app.csrf import CSRF_HEADER, new_csrf_token, set_csrf_cookie
from app.db_session import get_db
from app.deps import get_current_user
from app.models import User, UserSession
from app.security import hash_session_token, new_session_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    id: int
    email: EmailStr


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


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, response: Response, db: OrmSession = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(user.password_hash, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    raw = create_session(db, user.id)
    set_session_cookie(response, raw)

    csrf_token = new_csrf_token()
    set_csrf_cookie(response, csrf_token)
    response.headers[CSRF_HEADER] = csrf_token

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
        csrf_token = new_csrf_token()
        set_csrf_cookie(response, csrf_token)
        response.headers[CSRF_HEADER] = csrf_token
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
