from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session as OrmSession

from app.db import get_db
from app.models import User, UserSession
from app.security import hash_session_token
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def get_current_user(
    request: Request,
    db: OrmSession = Depends(get_db),
    bearer: str | None = Depends(oauth2_scheme),
) -> User:
    cookie_token = request.cookies.get(settings.COOKIE_NAME)
    candidates: list[str] = []
    if bearer:
        candidates.append(bearer)
    if cookie_token:
        candidates.append(cookie_token)

    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    now = datetime.now(timezone.utc)

    for raw in candidates:
        h = hash_session_token(raw)

        sess = (
            db.query(UserSession)
            .filter(UserSession.token_hash == h, UserSession.expires_at > now)
            .first()
        )
        if not sess:
            continue

        user = db.query(User).filter(User.id == sess.user_id).first()
        if not user:
            continue

        return user

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
