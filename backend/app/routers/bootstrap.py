from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session as OrmSession

from app.config import settings
from app.db import get_db
from app.models import User
from app.security import hash_password

router = APIRouter(prefix="/api/bootstrap", tags=["bootstrap"])

class BootstrapAdminIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)

def _is_local_request(request: Request) -> bool:
    host = request.client.host if request.client else ""
    return host in settings.BOOTSTRAP_ALLOW_HOSTS

@router.post("/admin")
def bootstrap_create_admin(
    payload: BootstrapAdminIn,
    request: Request,
    db: OrmSession = Depends(get_db),
):
    if not settings.BOOTSTRAP_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")

    if not _is_local_request(request):
        raise HTTPException(status_code=404, detail="Not found")

    if not settings.BOOTSTRAP_SETUP_KEY:
        raise HTTPException(status_code=500, detail="Bootstrap key is not configured")

    setup_key = request.headers.get("x-setup-key", "dev-setup-key-123")
    if setup_key != settings.BOOTSTRAP_SETUP_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")

    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(status_code=409, detail="Bootstrap already completed")

    email = payload.email.strip().lower()

    u = User(email=email, password_hash=hash_password(payload.password))
    db.add(u)
    db.commit()
    db.refresh(u)

    return {"ok": True, "admin": {"id": u.id, "email": u.email}}
