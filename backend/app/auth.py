from datetime import datetime,timezone,timedelta
from typing import Annotated, Optional
import jwt
from fastapi import Depends,HTTPException,status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from sqlmodel import Session,select
from app.core.config import SECRET_KEY,JWT_ALGORITHM,ACCESS_TOKEN_EXPIRE_MINUTES
from app.db import get_session
from app.models import User
from app.schemas import UserRead,TokenData

password_hasher=PasswordHash.recommended()
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(plain_password:str)->str:
    return password_hasher.hash(plain_password)

def verify_password(plain_password:str,hashed_password:str)->bool:
    return password_hasher.verify(plain_password,hashed_password)

def create_access_token(user_id:int)->str:
    now =datetime.now(timezone.utc)
    expire=now+timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    paylod = {
        "sub":str(user_id),
        "exp":expire,
    }
    encoded=jwt.encode(paylod,SECRET_KEY,algorithm="HS256")
    return encoded

def get_user_by_email(session:Session,email:str)->Optional[User]:
    statement=select(User).where(User.email==email)
    return session.exec(statement).first()

def get_user_by_id(session:Session,user_id:int)->Optional[User]:
    return session.get(User,user_id)

def authenticate_user(session:Session,email:str,password:str)->Optional[User]:
    user=get_user_by_email(session,email=email)
    if not user:
        return None
    if not verify_password(password,user.hashed_password):
        return None
    return user

async def get_current_user(
        token:Annotated[str,Depends(oauth2_scheme)],
        session:Annotated[Session,Depends(get_session)],
)->User:
    credentials_exception=HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate":"Bearer"},
    )

    try:
        payload=jwt.decode(token,SECRET_KEY,algorithms=[JWT_ALGORITHM])
        sub=payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id=int(sub)
    except(InvalidTokenError,ValueError):
        raise credentials_exception
    
    user=get_user_by_id(session,user_id)
    if user is None:
        raise credentials_exception
    return user

async def get_current_user_read(
        current_user:Annotated[User,Depends(get_current_user)],
)->UserRead:
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at)



