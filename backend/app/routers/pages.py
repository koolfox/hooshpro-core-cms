from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.page import PageCreate, PageUpdate, PageOut, PageListOut
from app.services import pages_service

router = APIRouter(tags=["pages"])


@router.get("/api/admin/pages", response_model=PageListOut)
def admin_list_pages(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
    q: str | None = None,
    status: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return pages_service.list_pages(db, limit, offset, q, status, sort, dir)


@router.get("/api/admin/pages/by-slug/{slug}", response_model=PageOut)
def admin_get_page_by_slug(
    slug: str,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = pages_service.get_page_by_slug(db, slug)
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return p


@router.get("/api/admin/pages/{page_id}", response_model=PageOut)
def admin_get_page(
    page_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = pages_service.get_page(db, page_id)
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return p


@router.post("/api/admin/pages", response_model=PageOut)
def admin_create_page(
    payload: PageCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
        return pages_service.create_page(db, payload)
    except pages_service.PageConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except pages_service.PageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.put("/api/admin/pages/{page_id}", response_model=PageOut)
def admin_update_page(
    page_id: int,
    payload: PageUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        payload.normalized()
        return pages_service.update_page(db, page_id, payload)
    except pages_service.PageNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except pages_service.PageConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except pages_service.PageValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/api/admin/pages/{page_id}")
def admin_delete_page(
    page_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pages_service.delete_page(db, page_id)
    return {"ok": True}


@router.get("/api/public/pages", response_model=PageListOut)
def public_list_pages(
    db: OrmSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    return pages_service.list_public_pages(db, limit, offset)


@router.get("/api/public/pages/{slug}", response_model=PageOut)
def public_get_page(slug: str, db: OrmSession = Depends(get_db)):
    p = pages_service.get_public_page_by_slug(db, slug)
    if not p:
        raise HTTPException(status_code=404, detail="Page not found")
    return p
