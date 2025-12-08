from typing import Annotated,List
from fastapi import APIRouter,Depends,HTTPException,status
from sqlmodel import Session,select

from app.auth import get_current_user
from app.db import get_session
from app.models import Project,User
from app.schemas import ProjectCreate,ProjectRead,ProjectUpdate

router = APIRouter(prefix="/projects",tags=["projects"])

def get_project_or_404(
        session:Session,
        project_id:int,
        current_user:User,
)->Project:
    statement=select(Project).where(Project.id==project_id,Project.owner_id==current_user.id)
    project=session.exec(statement).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Project not found",)
    return project

@router.get("/",response_model=List[ProjectRead])
def list_projects(session:Annotated[Session,Depends(get_session)],
                  current_user:Annotated[User,Depends(get_current_user)]):
    statement=select(Project).where(Project.owner_id==current_user.id).order_by(Project.created_at.desc())
    projects=session.exec(statement).all()
    return [ProjectRead(id=p.id,owner_id=p.owner_id,name=p.name,slug=p.slug,description=p.description,created_at=p.created_at) for p in projects]

@router.post("/",response_model=ProjectRead,status_code=status.HTTP_201_CREATED)
def create_project(
    project_in:ProjectCreate,
    session:Annotated[Session,Depends(get_session)],
    current_user:Annotated[User,Depends(get_current_user)]
):
    project=Project(
        owner_id=current_user.id,
        name=project_in.name,
        slug=project_in.slug,
        description=project_in.description
    )
    session.add(project)
    session.commit()
    session.refresh(project)

    return ProjectRead(
        id=project.id,
        owner_id=project.owner_id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        created_at=project.created_at,
    )

@router.get("/{project_id}",response_model=ProjectRead)
def get_project(
    project_id:int,
    session:Annotated[Session,Depends(get_session)],
    current_user:Annotated[User,Depends(get_current_user)],
):
    project=get_project_or_404(session,project_id,current_user)
    return ProjectRead(
        id=project.id,
        owner_id=project.owner_id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        created_at=project.created_at,
    )

@router.put("/{project_id}",response_model=ProjectRead)
def update_project(
    project_id:int,
    project_in:ProjectUpdate,
    session:Annotated[Session,Depends(get_session)],
    current_user:Annotated[User,Depends(get_current_user)],
):
    project=get_project_or_404(session,project_id,current_user)

    if project_in.name is not None:
        project.name=project_in.name
    if project_in.slug is not None:
        project.slug=project_in.slug
    if project_in.description is not None:
        project.description=project_in.description

    session.add(project)
    session.commit()
    session.refresh(project)

    return ProjectRead(
        id=project.id,
        owner_id=project.owner_id,
        name=project.name,
        slug=project.slug,
        description=project.description,
        created_at=project.created_at,
    )

@router.delete("/{project_id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id:int,
    session:Annotated[Session,Depends(get_session)],
    current_user=Annotated[User,Depends(get_current_user)],
):
    project=get_project_or_404(session,project_id,current_user)
    session.delete(project)
    session.commit()
    return None
