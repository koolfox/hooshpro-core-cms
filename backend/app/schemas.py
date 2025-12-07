from datetime import datetime
from typing import Optional
from pydantic import EmailStr
from sqlmodel import SQLModel

class UserCreate(SQLModel):
    email: EmailStr
    password:str

class UserRead(SQLModel):
    id:int
    email:EmailStr
    created_at:datetime

class Token(SQLModel):
    access_token:str
    token_type:str="bearer"

class TokenData(SQLModel):
    user_id:Optional[int]=None
