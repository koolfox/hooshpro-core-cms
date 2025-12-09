from typing import Any,Dict,List
from fastapi import APIRouter,Depends,HTTPException,status
from pydantic import BaseModel
from sqlmodel import Session,select

from app.db import get_session
from app.auth import get_current_user
from app.models import ContentType,FieldDef,Entry,User
from app.dynamic_schemas import build_entry_model_for_content_type
import json
from datetime import datetime

router = APIRouter(prefix="/api/public-content",tags=["public-content"])

class PublicEntryOut(BaseModel):
    slug:str
    data:Dict[str,Any]

@router.get("/{type_key}/{slug}",response_model=PublicEntryOut)
def get_published_entry(
    type_key:str,
    slug:str,
    session:Session=Depends(get_session),
):
    ct=session.exec(select(ContentType).where(ContentType.key==type_key)).first()
    if not ct:
        raise HTTPException(status_code=404,detail="Content type not found")
    
    entry=session.exec(select(Entry).where(Entry.content_type_id==ct.id,Entry.slug==slug,Entry.status=="published")).first()
    if not entry:
        raise HTTPException(status_code=404,detail="Entry not found")
    
    try:
        data=json.loads(entry.data_json)
    except json.JSONDecodeError:
        data={}

    return PublicEntryOut(slug=entry.slug,data=data)
