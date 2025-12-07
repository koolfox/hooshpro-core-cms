from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException,status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session,select

from app.auth import (authenticate_user,create_access_token,get_current_user_read,hash_password,)
from app.db import get_session
from app.models import User
from app.schemas import UserCreate,UserRead,Token

router = APIRouter(prefix="/auth",tags=["auth"])

@router.post("/signup",response_model=UserRead,status_code=status.HTTP_201_CREATED)
def signup(
    user_in:UserCreate,
    session:Annotated[Session,Depends(get_session)],
):
    existing=session.exec(select(User).where(User.email==user_in.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered",
                            )
    user =User(email=user_in.email,hashed_password=hash_password(user_in.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    return UserRead(id=user.id,
                    email=user.email,
                    created_at=user.created_at,)

@router.post("/login",response_model=Token)
def login(
    form_data:Annotated[OAuth2PasswordRequestForm,Depends()],
    session:Annotated[Session,Depends(get_session)],
):
    user = authenticate_user(session,email=form_data.username,password=form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate":"Bearer"},
        )
    print("USER FOUND")
    access_token=create_access_token(user_id=user.id)
    return Token(access_token=access_token,token_type="Bearer")

@router.get("/me",response_model=UserRead)
async def read_me(current_user:Annotated[UserRead,Depends(get_current_user_read)],
):
    return current_user
