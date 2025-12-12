from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException,Response,Request,status
from pydantic import BaseModel,EmailStr
from sqlalchemy.orm import Session as OrmSession
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime,timedelta,timezone
from app.auth import authenticate_user,create_access_token,get_current_user_read,hash_password
from app.db import get_session,get_db
from app.models import User,UserSession
from app.schemas import UserCreate,UserRead,Token
from app.security import hash_password,verify_password,new_session_token,hash_session_token

router = APIRouter(prefix="/api/auth",tags=["auth"])

COOKIE_NAME="hooshpro_session"
SESSION_DAYS=14

class LoginIn(BaseModel):
    email:EmailStr
    password:str

class MeOut(BaseModel):
    id:int
    email:EmailStr

def _cookie_settings():
    return dict(key=COOKIE_NAME,httponly=True,samesite="lax",secure=False,path="/")

@router.post("/login",response_model=MeOut)
def login(payload:LoginIn,response:Response,db:OrmSession=Depends(get_db)):
    user = db.query(User).filter(User.email==payload.email).first()
    if not user or not verify_password(user.password_hash,payload.password):
        raise HTTPException(status_code=401,detail="Invalid credentials")
    
    token=new_session_token()

    token_hash=hash_session_token(token)

    now = datetime.now(timezone.utc)
    expires_at=now+timedelta(SESSION_DAYS)

    session=UserSession(user_id=user.id,token_hash=token_hash,expires_at=expires_at)
    db.add(session)
    db.commit()

    response.set_cookie(value=token,max_age=SESSION_DAYS*24*3600,**_cookie_settings())
    return MeOut(id=user.id,email=user.email)

@router.post("/logout")
def logout(response:Response,request:Request,db:OrmSession=Depends(get_db)):
    token=request.cookies.get(COOKIE_NAME)
    if token:
        token_hash=hash_session_token(token)
        db.query(UserSession).filter(UserSession.token_hash==token_hash).delete()
        db.commit()

        response.delete_cookie(COOKIE_NAME,path="/")
        return{"ok:True"}
    
@router.get("/me",response_model=MeOut)
def me(request:Request,db:OrmSession=Depends(get_db)):
    token=request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401,detail="Not Authenticated")
    
    token_hash=hash_session_token(token)
    now = datetime.now(timezone.utc)

    session=(db.query(UserSession).filter(UserSession.token_hash==token_hash,UserSession.expires_at>now).first())
    if not session:
        raise HTTPException(status_code=401,detail="Mot Authenticated")
    
    user=db.query(User).filter(User.id==session.user_id).first()
    if not user:
        raise HTTPException(status_code=401,detail="Not Authenticated")
    
    return MeOut(id=user.id,email=user.email)
