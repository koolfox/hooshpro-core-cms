import json 
from datetime import datetime
from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy.exc import IntegrityError

from app.db import get_db
from app.deps import get_current_user
from app.models import Page,User
from app.schemas.page import PageCreate,PageUpdate,PageOut,validate_slug

router = APIRouter(tags=["pages"])

def page_to_out(p:Page)->PageOut:
    blocks=json.loads(p.blocks_json) if p.blocks_json else {"version":1,"blocks":[]}
    return PageOut(
        id=p.id,
        title=p.title,
        slug=p.slug,
        status=p.status,
        seo_title=p.seo_title,
        seo_description=p.seo_description,
        blocks=blocks,
        published_at=p.published_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )

def build_blocks(title:str,body:str,existing:dict|None=None)->dict:
    return {
        "version":1,
        "blocks":[
            {"type":"hero","data":{"headline":title,"subheadline":""}},
            {"type":"paragraph","data":{"text":body or ""}},
        ],
    }

@router.get("/api/admin/pages",response_model=list[PageOut])
def admin_list_pages(db:OrmSession=Depends(get_db),
                     user:User=Depends(get_current_user),):
    pages=db.query(Page).order_by(Page.updated_at.desc()).all()
    return [page_to_out(p) for p in pages]

@router.post("/api/admin/pages",response_model=PageOut)
def admin_create_page(payload:PageCreate,db:OrmSession=Depends(get_db),user:User=Depends(get_current_user)):
    payload.normalized()
    slug=validate_slug(payload.slug)

    blocks=build_blocks(payload.title,payload.body,payload.blocks)
    p=Page(
        title=payload.title,
        slug=slug,
        status=payload.status,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        blocks_json=json.dumps(blocks,ensure_ascii=False),
    )
    db.add(p)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409,detail="Slug already exists")
    
    db.refresh(p)
    return page_to_out(p)

@router.get("/api/admin/pages/{page_id}",response_model=PageOut)
def admin_get_page(
    page_id:int,
    db:OrmSession=Depends(get_db),
    user:User=Depends(get_current_user),
):
    p=db.query(Page).filter(Page.id==page_id).first()
    if not p:
        raise HTTPException(status_code=404,detail="Page not found")
    return page_to_out(p)

@router.put("/api/admin/pages/{page_id}",response_model=PageOut)
def admin_update_page(page_id:int,
                      payload:PageUpdate,
                      db:OrmSession=Depends(get_db),
                      user:User=Depends(get_current_user)):
    p=db.query(Page).filter(Page.id==page_id).first()
    if not p:
        raise HTTPException(status_code=404,detail="Page not found")
    
    if payload.title is not None:
        p.title=payload.title

    if payload.slug is not None:
        p.slug=payload.slug
    
    if payload.status is not None:
        if payload.status not in ("draft","published"):
            raise HTTPException(status_code=422,detail="status must be draft|published")
        p.status=payload.status

    if payload.seo_title is not None:
        p.seo_title=payload.seo_title
    if payload.seo_description is not None:
        p.seo_description=payload.seo_description

    blocks=None
    try:
        blocks=json.loads(p.blocks_json) if p.blocks_json else None
    except Exception:
        blocks=None

    if payload.body is not None:
        new_blocks=build_blocks(p.title,payload.body,blocks)
        p.blocks_json=json.dumps(new_blocks,ensure_ascii=False)
    elif payload.blocks is not None:
        p.blocks_json=json.dumps(payload.blocks,ensure_ascii=False)
    
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409,detail="Slug already exists")
    
    db.refresh(p)
    return page_to_out(p)

@router.delete("/api/admin/pages/{page_id}")
def admin_delete_page(
    page_id:int,
    db:OrmSession=Depends(get_db),
    user:User=Depends(get_current_user),
):
    p=db.query(Page).filter(Page.id==page_id).first()
    if not p:
        raise HTTPException(status_code=404,detail="Not found")
    db.delete(p)
    db.commit()
    return {"ok":True}

@router.get("/api/public/pages/{slug}",response_model=PageOut)
def public_get_page(slug:str,db:OrmSession=Depends(get_db)):
    slug=validate_slug(slug)
    p=db.query(Page).filter(Page.slug==slug,Page.status=="published").first()
    if not p:
        raise HTTPException(status_code=404,detail="Page not found")
    return page_to_out(p)
