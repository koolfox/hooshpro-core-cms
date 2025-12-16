from fastapi import APIRouter, Depends
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/ping")
def ping(user: User = Depends(get_current_user)):
    return {"ok": True, "user": {"id": user.id, "email": user.email}}
