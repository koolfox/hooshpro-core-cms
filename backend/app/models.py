from datetime import datetime, timezone, timedelta
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

def utcnow():
    return datetime.now(timezone.utc)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

class UserSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")
    @staticmethod
    def default_expiry(days:int)->datetime:
         return utcnow()+timedelta(days=days)

class Page(Base):
           __tablename__="pages"
           id:Mapped[int]=mapped_column(Integer,primary_key=True)
           title:Mapped[str]=mapped_column(String(200),nullable=False)
           slug:Mapped[str]=mapped_column(String(200),unique=True,index=True,nullable=False)
           status:Mapped[str]=mapped_column(String(20),index=True,default="draft")
           seo_title:Mapped[str|None]=mapped_column(String(200),nullable=True)
           seo_description:Mapped[str|None]=mapped_column(String(500),nullable=True)
           blocks_json:Mapped[str]=mapped_column(Text,nullable=False,default='{"version:1,"blocks":[]}')
           created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)
           updated_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,onupdate=utcnow)


