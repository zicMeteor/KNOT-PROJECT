from sqlalchemy import Boolean, Column, Integer, String, Text, TIMESTAMP, Enum
from sqlalchemy import ForeignKey
from sqlalchemy.sql import func
from database.database import Base

class agenthistory_class(Base):
    __tablename__ = "agenthistory"
    AgentHistory_id = Column(Integer, primary_key=True, autoincrement=True)
    Content_id = Column(Integer, ForeignKey("content.Content_id"))
    trigger_type = Column(Enum("manual", "auto"))
    Action_Plan = Column(Text(65535))
    goal = Column(Text(65535))
    result = Column(Text(65535))
    created_at = Column(TIMESTAMP, server_default=func.now())
    
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
    created_at = Column(TIMESTAMP, server_default=func.now())

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
    created_at = Column(TIMESTAMP, server_default=func.now())


# 시연 결과보고서용 기록: 분석·저장·저장 안 함·AI 검색이 일어날 때마다 한 줄씩 쌓는다
# 서버를 켜면 main.py의 Base.metadata.create_all이 이 표를 만든다 (이미 있는 표는 건드리지 않는다)
class eventlog_class(Base):
    __tablename__ = "eventlog"
    EventLog_id = Column(Integer, primary_key=True, autoincrement=True)
    event = Column(String(30))  # analyze_url, analyze_pdf, save, discard, search
    ok = Column(Boolean)  # 성공 여부
    ms = Column(Integer)  # 걸린 시간 (밀리초). 저장 안 함은 비움
    detail = Column(Text(65535))  # 나머지 정보 (JSON 문자열)
    created_at = Column(TIMESTAMP, server_default=func.now())
