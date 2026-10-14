# 로그인·로그아웃·내 정보. 이 라우터는 로그인 없이 부를 수 있다
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

import settings
from database.database import get_db
from database.models import users_class
from services import ai_quota
from services.auth import (
    COOKIE_NAME, clear_fails, create_session, delete_session, locked_seconds,
    record_fail, user_from_token, verify_password, _LOCAL_USER,
)
from services.event_log import log_event


class Login_Request(BaseModel):
    username: str
    password: str


router = APIRouter()


def _me(db, user):
    return {
        "auth": settings.AUTH_ENABLED,
        "username": user.username,
        "role": user.role,
        "ai": ai_quota.usage(db, user),
        "source_url": settings.SOURCE_URL,
        "survey_url": settings.SURVEY_URL or None,
        "failure_assist": settings.FAILURE_ASSIST,
    }


@router.post("/auth/login")
def login(request: Login_Request, response: Response, db: Session = Depends(get_db)):
    if not settings.AUTH_ENABLED:
        return _me(db, _LOCAL_USER)
    username = request.username.strip()
    wait = locked_seconds(username)
    if wait:
        raise HTTPException(
            status_code=429,
            detail=f"로그인 시도가 많아 잠시 막혔습니다. {max(1, wait // 60)}분 뒤에 다시 시도하세요.",
        )
    user = db.query(users_class).filter(users_class.username == username).first()
    if not user or user.disabled or not verify_password(request.password, user.password_hash):
        record_fail(username)
        log_event("login", False, users_id=None, username=username)
        # 아이디와 비밀번호 중 무엇이 틀렸는지는 알려 주지 않는다
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호를 다시 확인하세요.")
    clear_fails(username)
    token, expires = create_session(db, user)
    max_age = max(60, int((expires - __import__("datetime").datetime.now()).total_seconds()))
    response.set_cookie(
        COOKIE_NAME, token, max_age=max_age, httponly=True,
        secure=settings.COOKIE_SECURE, samesite="lax", path="/",
    )
    log_event("login", True, users_id=user.users_id, username=username)
    current = user_from_token(db, token)
    return _me(db, current)


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    delete_session(db, request.cookies.get(COOKIE_NAME))
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/auth/me")
def me(request: Request, db: Session = Depends(get_db)):
    if not settings.AUTH_ENABLED:
        return _me(db, _LOCAL_USER)
    user = user_from_token(db, request.cookies.get(COOKIE_NAME))
    if user is None:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    return _me(db, user)
