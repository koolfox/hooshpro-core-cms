from typing import Any,Dict,Tuple,Type

from pydantic import BaseModel, create_model


from sqlmodel import Session, select

TYPE_MAP={
    "string": str,
    "text":str,
    "number":float,
    "boolean":bool,
    "datetime":str,
}

