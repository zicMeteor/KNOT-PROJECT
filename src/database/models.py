from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Enum
from sqlalchemy import ForeignKey
from database.database import Base

class agenthistory_class(Base):
    __tablename__ = "agenthistory"
    AgentHistory_id = Column(Integer, primary_key=True, autoincrement=True)
    Content_id = Column(Integer, ForeignKey("content.Content_id"))
    trigger_type = Column(Enum("manual", "auto"))
    Action_Plan = Column(Text(65535))
    goal = Column(Text(65535))
    result = Column(Text(65535))
    created_at = Column(TIMESTAMP)
    
class content_class(Base):
    __tablename__ = "content"
    Content_id = Column(Integer, primary_key=True, autoincrement=True)
    users_id = Column(Integer, ForeignKey("users.users_id"))
    category = Column(Enum("학습", "참고", "연구", "아이디어", "도구", "기타"))
    source = Column(Text(65535))
    title = Column(Text(65535))
    summary = Column(String(300))
    URL = Column(String(2083))
    memo = Column(Text(65535))
    created_at = Column(TIMESTAMP)

class contenttag_class(Base):
    __tablename__ = "contenttag"
    ContentTag_id = Column(Integer, primary_key=True, autoincrement=True)
    Content_id = Column(Integer, ForeignKey("content.Content_id"))
    Tag_id = Column(Integer, ForeignKey("tag.Tag_id"))
    
class tag_class(Base):
    __tablename__ = "tag"
    Tag_id = Column(Integer, primary_key=True, autoincrement=True)
    Name = Column(String(255))
    Name_lower = Column(String(255))

class users_class(Base):
    __tablename__ = "users"
    users_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255))
    google_id = Column(Text(65535))
    created_at = Column(TIMESTAMP)
    
    