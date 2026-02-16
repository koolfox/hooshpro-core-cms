from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.option import (
    OptionListOut,
    OptionOut,
    OptionSetIn,
    PublicOptionsOut,
)
from app.services import options_service

router = APIRouter(tags=["options"])


@router.get("/api/admin/options", response_model=OptionListOut)
def admin_list_options(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    keys: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return options_service.list_options(db, limit, offset, q, keys, sort, dir)


@router.get("/api/admin/options/{key}", response_model=OptionOut)
def admin_get_option(
    key: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    o = options_service.get_option(db, key)
    if not o:
        raise HTTPException(status_code=404, detail="Option not found")
    return o


@router.put("/api/admin/options/{key}", response_model=OptionOut)
def admin_set_option(
    key: str,
    payload: OptionSetIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return options_service.set_option(db, key, payload.value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/options/{key}")
def admin_delete_option(
    key: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        options_service.delete_option(db, key)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/public/options", response_model=PublicOptionsOut)
def public_get_options(
    db: OrmSession = Depends(get_db),
    keys: str | None = None,
):
    return options_service.public_get_options(db, keys)

