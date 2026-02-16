from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.content import (
    ContentEntryCreate,
    ContentEntryListOut,
    ContentEntryOut,
    ContentEntryUpdate,
    ContentFieldCreate,
    ContentFieldListOut,
    ContentFieldOut,
    ContentFieldReorderIn,
    ContentFieldUpdate,
    ContentTypeCreate,
    ContentTypeListOut,
    ContentTypeOut,
    ContentTypeUpdate,
    PublicContentEntryListOut,
    PublicContentEntryOut,
)
from app.services import collections_service

router = APIRouter(tags=["collections"])


@router.get("/api/admin/content-types", response_model=ContentTypeListOut)
def admin_list_content_types(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return collections_service.list_content_types(db, limit, offset, q, sort, dir)


@router.post("/api/admin/content-types", response_model=ContentTypeOut)
def admin_create_content_type(
    payload: ContentTypeCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.create_content_type(db, payload)
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/api/admin/content-types/{type_id}", response_model=ContentTypeOut)
def admin_get_content_type(
    type_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ct = collections_service.get_content_type(db, type_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Content type not found")
    return ct


@router.put("/api/admin/content-types/{type_id}", response_model=ContentTypeOut)
def admin_update_content_type(
    type_id: int,
    payload: ContentTypeUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.update_content_type(db, type_id, payload)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/api/admin/content-types/{type_id}")
def admin_delete_content_type(
    type_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        collections_service.delete_content_type(db, type_id)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/content-types/{type_id}/fields", response_model=ContentFieldListOut)
def admin_list_fields(
    type_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return collections_service.list_fields(db, type_id)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/api/admin/content-types/{type_id}/fields", response_model=ContentFieldOut)
def admin_create_field(
    type_id: int,
    payload: ContentFieldCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.create_field(db, type_id, payload)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.put("/api/admin/content-types/{type_id}/fields/{field_id}", response_model=ContentFieldOut)
def admin_update_field(
    type_id: int,
    field_id: int,
    payload: ContentFieldUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.update_field(db, type_id, field_id, payload)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/api/admin/content-types/{type_id}/fields/{field_id}")
def admin_delete_field(
    type_id: int,
    field_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        collections_service.delete_field(db, type_id, field_id)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.put("/api/admin/content-types/{type_id}/fields/reorder")
def admin_reorder_fields(
    type_id: int,
    payload: ContentFieldReorderIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        collections_service.reorder_fields(db, type_id, payload)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/entries", response_model=ContentEntryListOut)
def admin_list_entries(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    type: str | None = None,
    limit: int = 20,
    offset: int = 0,
    q: str | None = None,
    status: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return collections_service.list_entries(db, type, limit, offset, q, status, sort, dir)


@router.post("/api/admin/entries", response_model=ContentEntryOut)
def admin_create_entry(
    payload: ContentEntryCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.create_entry(db, payload)
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except collections_service.CollectionBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/api/admin/entries/{entry_id}", response_model=ContentEntryOut)
def admin_get_entry(
    entry_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    e = collections_service.get_entry(db, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return e


@router.put("/api/admin/entries/{entry_id}", response_model=ContentEntryOut)
def admin_update_entry(
    entry_id: int,
    payload: ContentEntryUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return collections_service.update_entry(db, entry_id, payload)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except collections_service.CollectionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except collections_service.CollectionBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/entries/{entry_id}")
def admin_delete_entry(
    entry_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        collections_service.delete_entry(db, entry_id)
    except collections_service.CollectionNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/public/entries/{type_slug}", response_model=PublicContentEntryListOut)
def public_list_entries(
    type_slug: str,
    db: OrmSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
    sort: str | None = None,
    dir: str | None = None,
):
    return collections_service.public_list_entries(db, type_slug, limit, offset, sort, dir)


@router.get("/api/public/entries/{type_slug}/{entry_slug}", response_model=PublicContentEntryOut)
def public_get_entry(
    type_slug: str,
    entry_slug: str,
    db: OrmSession = Depends(get_db),
):
    e = collections_service.public_get_entry(db, type_slug, entry_slug)
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return e

