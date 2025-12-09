from typing import Any,Dict,List
from fastapi import APIRouter,Depends,HTTPException,status
from sqlmodel import Session,select

from app.db import get_session
from app.auth import get_current_user
from app.models import ContentType,FieldDef,Entry,User
from app.dynamic_schemas import build_entry_model_for_content_type
import json
from datetime import datetime

router = APIRouter(prefix="/admin",tags=["admin-content"])

from pydantic import BaseModel

class FieldMetaOut(BaseModel):
    name:str
    label:str
    type:str
    required:bool
    list:bool
    filterable:bool
    order_index:int

class ContentTypeOut(BaseModel):
    key:str
    label:str
    description:str|None=None
    singleton:bool
    fields:List[FieldMetaOut]


@router.get("/content-types", response_model=List[ContentTypeOut])
def list_contetn_types(
    session:Session=Depends(get_session),
    # current_user:User=Depends(get_current_user),
):
    cts=session.exec(select(ContentType)).all()
    results:List[ContentTypeOut]=[]

    for ct in cts:
        fields=session.exec(select(FieldDef).where(FieldDef.content_type_id==ct.id).order_by(FieldDef.order_index)).all()
        results.append(ContentTypeOut(
            key=ct.key,
            label=ct.label,
            description=ct.description,
            singleton=ct.singleton,
            fields=[FieldMetaOut(
                name=f.name,
                label=f.label,
                type=f.type,
                required=f.required,
                list=f.list,
                filterable=f.filterable,
                order_index=f.order_index,)
                for f in fields]))
        return results
    
class EntrySummaryOut(BaseModel):
    id:int
    slug:str
    status:str
    created_at:datetime
    updated_at:datetime
    data:Dict[str,Any]

@router.get("/content/{type_key}",response_model=List[EntrySummaryOut])
def list_entries(
    type_key:str,
    session:Session=Depends(get_session),
    current_user:User=Depends(get_current_user),
):
    ct=session.exec(select(ContentType).where(ContentType.key==type_key)).first()
    if not ct:
        raise HTTPException(status_code=404,detail="Content type not found.")
    
    entries=session.exec(select(Entry).where(Entry.content_type_id==ct.id).order_by(Entry.created_at.desc())).all()

    result: List[EntrySummaryOut]=[]
    for e in entries:
        try:
            data=json.loads(e.data_json)
        except json.JSONDecodeError:
            data={}
        result.append(
            EntrySummaryOut(
                id=e.id,
                slug=e.slug,
                status=e.status,
                created_at=e.created_at,
                updated_at=e.updated_at,
                data=data,
            )
        )
    return result

@router.post("/content/{type_key}",response_model=EntrySummaryOut,status_code=status.HTTP_201_CREATED,)
def create_entry(
    type_key:str,
    payload:Dict[str,Any],
    session:Session=Depends(get_session),
    current_user:User=Depends(get_current_user),
):
    try:
        DynamicModel = build_entry_model_for_content_type(session,type_key)
    except ValueError:
        raise HTTPException(status_code=404,detail="Content type not found")
    
    try:
        obj = DynamicModel.parse_obj(payload)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,detail=str(e))
    

    data=obj.dict()
    slug=data.get("slug")
    if not slug:
        raise HTTPException(status_code=400,detail="Missing slug")
    
    ct=session.exec(select(ContentType).where(ContentType.key==type_key)).first()

    entry=Entry(
        content_type_id=ct.id,
        slug=slug,
        status="draft",
        data_json=json.dumps(data,ensure_ascii=False)
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return EntrySummaryOut(
        id=entry.id,
        slug=entry.slug,
        status=entry.status,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        data=data,
    )
