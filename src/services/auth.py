# 로그인: 비밀번호 해시, 세션 쿠키, 로그인 실패 잠금, 지금 요청한 사용자 찾기
import base64
import contextvars
import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from datetime import time as dtime

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

import settings
from database.database import get_db
from database.models import users_class, usersession_class

COOKIE_NAME = "knot_session"

# 역할별 기본값: 하루·주 AI 상한, 로그인 유지 기간 (일). booth는 그날 밤 23:59까지
ROLE_DEFAULTS = {
    "admin": {"ai_limit": None, "ai_period": None, "session_days": 30},
    "showcase": {"ai_limit": None, "ai_period": None, "session_days": 30},
    "tester": {"ai_limit": 150, "ai_period": "week", "session_days": 7},
    "booth": {"ai_limit": 100, "ai_period": "day", "session_days": 0},
}

# 로그인 실패 잠금: 같은 아이디로 LOCK_FAILS번 틀리면 LOCK_SECONDS초 동안 막는다
LOCK_FAILS = 5
LOCK_SECONDS = 300

# 지금 요청한 사용자 번호. 사용 기록(event_log)이 따로 넘겨받지 않아도 읽는다
current_user_id = contextvars.ContextVar("current_user_id", default=None)


@dataclass
class CurrentUser:
    id: int
    username: str | None
    role: str
    ai_limit: int | None
    ai_period: str | None


# ---------- 비밀번호 ----------
# scrypt (파이썬 기본 기능). 저장 형식: scrypt$N$r$p$소금$해시 (소금·해시는 base64)
_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    b64 = lambda b: base64.b64encode(b).decode()
    return f"scrypt${_N}${_R}${_P}${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algo, n, r, p, salt, digest = stored.split("$")
        if algo != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt),
            n=int(n), r=int(r), p=int(p), dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def generate_password(length=10) -> str:
    # 헷갈리는 글자(0 O 1 l I)를 뺀 무작위 비밀번호
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------- 로그인 실패 잠금 (서버 메모리. 서버를 다시 켜면 풀린다) ----------
_fails: dict[str, list[float]] = {}
_fails_lock = threading.Lock()


def locked_seconds(username: str) -> int:
    """잠겨 있으면 남은 초, 아니면 0"""
    now = time.time()
    with _fails_lock:
        recent = [t for t in _fails.get(username, []) if now - t < LOCK_SECONDS]
        _fails[username] = recent
        if len(recent) >= LOCK_FAILS:
            return int(LOCK_SECONDS - (now - recent[-1])) + 1
    return 0


def record_fail(username: str):
    with _fails_lock:
        _fails.setdefault(username, []).append(time.time())


def clear_fails(username: str):
    with _fails_lock:
        _fails.pop(username, None)


# ---------- 세션 ----------
def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def session_expiry(role: str) -> datetime:
    days = ROLE_DEFAULTS.get(role, ROLE_DEFAULTS["tester"])["session_days"]
    if days <= 0:
        # 부스 계정: 그날 밤까지만
        return datetime.combine(date.today(), dtime(23, 59, 59))
    return datetime.now() + timedelta(days=days)


def create_session(db: Session, user: users_class) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = session_expiry(user.role or "tester")
    db.add(usersession_class(token_hash=_token_hash(token), users_id=user.users_id, expires_at=expires))
    # 만료된 세션은 이참에 지운다
    db.query(usersession_class).filter(usersession_class.expires_at < datetime.now()).delete()
    db.commit()
    return token, expires


def delete_session(db: Session, token: str | None):
    if not token:
        return
    db.query(usersession_class).filter(usersession_class.token_hash == _token_hash(token)).delete()
    db.commit()


def _to_current(user: users_class) -> CurrentUser:
    return CurrentUser(
        id=user.users_id,
        username=user.username,
        role=user.role or "tester",
        ai_limit=user.ai_limit,
        ai_period=user.ai_period,
    )


def user_from_token(db: Session, token: str | None) -> CurrentUser | None:
    if not token:
        return None
    row = db.query(usersession_class).filter(usersession_class.token_hash == _token_hash(token)).first()
    if not row or (row.expires_at and row.expires_at < datetime.now()):
        return None
    user = db.query(users_class).filter(users_class.users_id == row.users_id).first()
    if not user or user.disabled:
        return None
    return _to_current(user)


# 로그인을 끈 상태(v1과 같음)에서 쓰는 사용자
_LOCAL_USER = CurrentUser(id=1, username=None, role="admin", ai_limit=None, ai_period=None)


def current_user(request: Request, db: Session = Depends(get_db)) -> CurrentUser:
    """API마다 붙이는 의존성. 로그인하지 않았으면 401"""
    if not settings.AUTH_ENABLED:
        user = _LOCAL_USER
    else:
        user = user_from_token(db, request.cookies.get(COOKIE_NAME))
        if user is None:
            raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    current_user_id.set(user.id)
    # 하루 첫 요청에 그래프 상태를 한 줄 남긴다 (결과보고서용, 실패해도 요청은 계속)
    from services.graph_snapshot import ensure_today

    ensure_today(db, user.id)
    return user


def require_admin(user: CurrentUser = Depends(current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자만 볼 수 있습니다.")
    return user
