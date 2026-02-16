from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.db_session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.taxonomy import (
    EntryTermListOut,
    EntryTermSetIn,
    PublicTermListOut,
    TaxonomyCreate,
    TaxonomyListOut,
    TaxonomyOut,
    TaxonomyUpdate,
    TermCreate,
    TermListOut,
    TermOut,
    TermUpdate,
)
from app.services import taxonomies_service

router = APIRouter(tags=["taxonomies"])


@router.get("/api/admin/taxonomies", response_model=TaxonomyListOut)
def admin_list_taxonomies(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    return taxonomies_service.list_taxonomies(db, limit, offset, q, sort, dir)


@router.post("/api/admin/taxonomies", response_model=TaxonomyOut)
def admin_create_taxonomy(
    payload: TaxonomyCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return taxonomies_service.create_taxonomy(db, payload)
    except taxonomies_service.TaxonomyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/api/admin/taxonomies/{taxonomy_id}", response_model=TaxonomyOut)
def admin_get_taxonomy(
    taxonomy_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = taxonomies_service.get_taxonomy(db, taxonomy_id)
    if not t:
        raise HTTPException(status_code=404, detail="Taxonomy not found")
    return t


@router.put("/api/admin/taxonomies/{taxonomy_id}", response_model=TaxonomyOut)
def admin_update_taxonomy(
    taxonomy_id: int,
    payload: TaxonomyUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return taxonomies_service.update_taxonomy(db, taxonomy_id, payload)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except taxonomies_service.TaxonomyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.delete("/api/admin/taxonomies/{taxonomy_id}")
def admin_delete_taxonomy(
    taxonomy_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        taxonomies_service.delete_taxonomy(db, taxonomy_id)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/taxonomies/{taxonomy_id}/terms", response_model=TermListOut)
def admin_list_terms(
    taxonomy_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
    q: str | None = None,
    sort: str | None = None,
    dir: str | None = None,
):
    try:
        return taxonomies_service.list_terms(db, taxonomy_id, limit, offset, q, sort, dir)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/api/admin/taxonomies/{taxonomy_id}/terms", response_model=TermOut)
def admin_create_term(
    taxonomy_id: int,
    payload: TermCreate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return taxonomies_service.create_term(db, taxonomy_id, payload)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except taxonomies_service.TaxonomyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.put("/api/admin/taxonomies/{taxonomy_id}/terms/{term_id}", response_model=TermOut)
def admin_update_term(
    taxonomy_id: int,
    term_id: int,
    payload: TermUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    payload.normalized()
    try:
        return taxonomies_service.update_term(db, taxonomy_id, term_id, payload)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except taxonomies_service.TaxonomyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except taxonomies_service.TaxonomyBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/api/admin/taxonomies/{taxonomy_id}/terms/{term_id}")
def admin_delete_term(
    taxonomy_id: int,
    term_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        taxonomies_service.delete_term(db, taxonomy_id, term_id)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"ok": True}


@router.get("/api/admin/entries/{entry_id}/terms", response_model=EntryTermListOut)
def admin_get_entry_terms(
    entry_id: int,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return taxonomies_service.get_entry_terms(db, entry_id)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/api/admin/entries/{entry_id}/terms", response_model=EntryTermListOut)
def admin_set_entry_terms(
    entry_id: int,
    payload: EntryTermSetIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return taxonomies_service.set_entry_terms(db, entry_id, payload)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except taxonomies_service.TaxonomyBadRequest as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/public/taxonomies/{taxonomy_slug}/terms", response_model=PublicTermListOut)
def public_list_terms(
    taxonomy_slug: str,
    db: OrmSession = Depends(get_db),
):
    try:
        return taxonomies_service.public_list_terms(db, taxonomy_slug)
    except taxonomies_service.TaxonomyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc))

