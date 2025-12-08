from typing import Optional
from datetime import datetime,timezone
from sqlmodel import SQLModel, Field
import sqlalchemy as sa
from pydantic import EmailStr

class HealthRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at:datetime=Field(
        sa_column=sa.column(sa.DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc))
    
class User(SQLModel,table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: EmailStr=Field(index=True,sa_column_kwargs={"unique":True})
    hashed_password:str
    created_at:datetime=Field(
        sa_column=sa.column(sa.DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc))

class Project(SQLModel,table=True):
    id:Optional[int]= Field(default=None,primary_key=True)
    owner_id:int=Field(index=True)
    name:str=Field(max_length=200,index=True)
    slug:str=Field(max_length=200,index=True)
    description:Optional[str]=Field(default=None)
    created_at:datetime=Field(
        sa_column=sa.column(sa.DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )
