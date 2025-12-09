from typing import Optional
from datetime import datetime,timezone
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column,Text,DateTime
from pydantic import EmailStr

class HealthRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at:datetime=Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc))
    
class User(SQLModel,table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: EmailStr=Field(index=True,sa_column_kwargs={"unique":True})
    hashed_password:str
    created_at:datetime=Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc))

class Project(SQLModel,table=True):
    id:Optional[int]= Field(default=None,primary_key=True)
    owner_id:int=Field(index=True)
    name:str=Field(max_length=200,index=True)
    slug:str=Field(max_length=200,index=True)
    description:Optional[str]=Field(default=None)
    created_at:datetime=Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )

class ContentType(SQLModel,table=True):
    __tablename__ = "content_types"

    id: Optional[int] = Field(default=None, primary_key=True)

    key: str = Field(index=True,unique=True,max_length=100)
    label: str = Field(max_length=200)
    description: Optional[str] = None
    singleton: bool = Field(default=False)

    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )

    fields: list["FieldDef"] = Relationship(back_populates="content_type")
    entries: list["Entry"] = Relationship(back_populates="content_type")

class FieldDef(SQLModel,table=True):
    __tablename__ = "fields"

    id: Optional[int] = Field(default=None, primary_key=True)

    content_type_id: int = Field(foreign_key="content_types.id",index=True)

    name: str = Field(max_length=100)
    label: str = Field(max_length=200)
    type: str = Field(max_length=50)
    required: bool = Field(default=False)
    list: bool = Field(default=True)
    filterable: bool = Field(default=False)
    order_index: int = Field(default=0)

    config_json: Optional[str] = Field(default=None,sa_column=Column(Text))

    content_type: ContentType = Relationship(back_populates="fields")

class Entry(SQLModel, table=True):
    __tablename__= "entries"

    id: Optional[int] = Field(default=None, primary_key=True)

    content_type_id: int = Field(foreign_key="content_types.id", index=True)

    slug: str = Field(index=True, max_length=200)

    status: str = Field(default="draft", max_length=50)

    data_json: str = Field(sa_column=Column(Text))

    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    published_at: Optional[datetime] = Field(
        sa_column=Column(DateTime(timezone=True)),
        default_factory=lambda: datetime.now(timezone.utc)
    )

    content_type: ContentType = Relationship(back_populates="entries")
