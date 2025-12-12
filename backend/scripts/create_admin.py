import getpass
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Base,User
from app.db import engine
from app.security import hash_password

def main():
    Base.metadata.create_all(bind=engine)

    email=input("Admin email: ").strip().lower()
    password=getpass.getpass("Admin password: ")

    db:Session=SessionLocal()

    exists=db.query(User).filter(User.email==email).first()
    if exists:
        print("User already exists.")
        return
    user=User(email=email,password_hash=hash_password(password))
    db.add(user)
    db.commit()
    print("Admin created.")

if __name__=="__main__":
    main()
