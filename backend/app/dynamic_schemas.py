from typing import Any,Dict,Tuple,Type

from pydantic import BaseModel, create_model

from app.models import ContentType, FieldDef
from sqlmodel import Session, select

TYPE_MAP={
    "string": str,
    "text":str,
    "number":float,
    "boolean":bool,
    "datetime":str,
}

def build_entry_model_for_content_type(
        session:Session,
        content_type_key: str,
)->Type[BaseModel]:
    ct = session.exec(select(ContentType).where(ContentType.key==content_type_key)).first()
    if not ct:
        raise ValueError(f"Unknown content type: {content_type_key}")
    
    fields=session.exec(select(FieldDef).where(FieldDef.content_type_id==ct.id).order_by(FieldDef.order_index)).all()

    field_definitions: Dict[str, Tuple[Any,Any]]={}

    for f in fields:
        py_type=TYPE_MAP.get(f.type,str)
        default=None
        
        if f.required:
            default = ...
        else:
            py_type = py_type|None
            default=None

        field_definitions[f.name] = (py_type,default)

    DynamicModel = create_model(f"{ct.key.capitalize()}EntryModel",
                                __base__=BaseModel,
                                **field_definitions,)
    return DynamicModel
