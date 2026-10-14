from sqlalchemy import Boolean, Column, Date, Integer, String, Text, TIMESTAMP, Enum
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database.database import Base

# 이미 있는 DB에 아래 표·칸을 더할 때는 scripts/migrate.py를 실행한다
# (create_all은 새 표만 만들고, 이미 있는 표에 칸을 더하지 않는다)

# 재분류·태그 맞추기·되돌리기 이력: 자료 하나가 바뀔 때마다 한 줄
# 같은 run_id = 한 번에 적용한 묶음. before/after는 {"category": ..., "tags": [...]} JSON
class agenthistory_class(Base):
    __tablename__ = "agenthistory"
    AgentHistory_id = Column(Integer, primary_key=True, autoincrement=True)
    Content_id = Column(Integer, ForeignKey("content.Content_id"))
    trigger_type = Column(Enum("manual", "auto"))
    Action_Plan = Column(Text(65535))  # (v1에서 쓰지 않던 칸. 지금도 쓰지 않음)
    goal = Column(Text(65535))  # 재분류 목적
    result = Column(Text(65535))  # AI가 든 이유
    created_at = Column(TIMESTAMP, server_default=func.now())
    users_id = Column(Integer, ForeignKey("users.users_id"))
    run_id = Column(String(36))
    kind = Column(String(20))  # reclassify, tag_merge, undo
    before_json = Column(Text(65535))
    after_json = Column(Text(65535))
    undone = Column(Boolean, default=False)

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
    # ai = 보통 분석, ai_short = 짧은 본문으로 분석, manual = 직접 입력, pending = 분석 대기
    analysis_status = Column(String(20), default="ai")
    # 부스 계정에 미리 복사해 넣은 기본 자료 (방문객이 넣은 자료와 구분)
    is_seed = Column(Boolean, default=False)

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
    # 관리자가 scripts/accounts.py로 만든다. 공개 가입은 없다
    username = Column(String(50), unique=True)
    password_hash = Column(String(255))
    role = Column(String(20))  # admin, showcase, tester, booth
    ai_limit = Column(Integer)  # 비우면 제한 없음
    ai_period = Column(String(10))  # day 또는 week
    disabled = Column(Boolean, default=False)


# 로그인 세션: 브라우저 쿠키에는 토큰 원문, DB에는 토큰의 해시만 둔다
class usersession_class(Base):
    __tablename__ = "usersession"
    token_hash = Column(String(64), primary_key=True)
    users_id = Column(Integer, ForeignKey("users.users_id"), index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP)


# AI 호출 한 번마다 한 줄. 계정별 사용량 상한을 셀 때 쓴다
class aiusage_class(Base):
    __tablename__ = "aiusage"
    AiUsage_id = Column(Integer, primary_key=True, autoincrement=True)
    users_id = Column(Integer, ForeignKey("users.users_id"), index=True)
    kind = Column(String(20))  # analyze, search, reclassify, tag_merge
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)


# AI 결과마다 누르는 좋아요·싫어요
class feedback_class(Base):
    __tablename__ = "feedback"
    Feedback_id = Column(Integer, primary_key=True, autoincrement=True)
    users_id = Column(Integer, ForeignKey("users.users_id"), index=True)
    target = Column(String(30))  # analysis, search, reclassify
    value = Column(Integer)  # 1 = 좋아요, -1 = 싫어요
    ref = Column(Text(65535))  # 무엇에 대한 평가인지 (주소, 검색어, 자료 번호 등)
    detail = Column(Text(65535))  # 나머지 정보 (JSON 문자열)
    created_at = Column(TIMESTAMP, server_default=func.now())


# 계정별 그래프 상태를 하루 한 줄 남긴다 (결과보고서에서 날짜별 변화를 보이려고)
class graphsnapshot_class(Base):
    __tablename__ = "graphsnapshot"
    __table_args__ = (UniqueConstraint("users_id", "day", name="uq_snapshot_user_day"),)
    GraphSnapshot_id = Column(Integer, primary_key=True, autoincrement=True)
    users_id = Column(Integer, ForeignKey("users.users_id"))
    day = Column(Date)
    contents = Column(Integer)  # 자료 수
    tags = Column(Integer)  # 자료에 붙은 서로 다른 태그 수
    links = Column(Integer)  # 같은 자료에 함께 붙은 태그 쌍의 수 (그래프의 선)
    isolated = Column(Integer)  # 어떤 태그와도 이어지지 않은 태그 수
    created_at = Column(TIMESTAMP, server_default=func.now())


# 시연 결과보고서용 기록: 분석·저장·저장 안 함·AI 검색이 일어날 때마다 한 줄씩 쌓는다
# 서버를 켜면 main.py의 Base.metadata.create_all이 이 표를 만든다 (이미 있는 표는 건드리지 않는다)
class eventlog_class(Base):
    __tablename__ = "eventlog"
    EventLog_id = Column(Integer, primary_key=True, autoincrement=True)
    event = Column(String(30))  # analyze_url, analyze_pdf, save, discard, search 등
    ok = Column(Boolean)  # 성공 여부
    ms = Column(Integer)  # 걸린 시간 (밀리초). 저장 안 함은 비움
    detail = Column(Text(65535))  # 나머지 정보 (JSON 문자열)
    created_at = Column(TIMESTAMP, server_default=func.now())
    users_id = Column(Integer)  # 누가 했는지 (로그인 실패처럼 사용자를 모르면 비움)
