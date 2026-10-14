# 계정별 AI 사용량 상한: AI를 부르기 직전에 consume()을 부른다
from datetime import date, datetime, timedelta

from database.models import aiusage_class


class QuotaExceeded(Exception):
    """상한을 넘었다. 라우터가 429로 바꾼다"""


def period_start(period: str) -> datetime:
    today = datetime.combine(date.today(), datetime.min.time())
    if period == "week":
        # 이번 주 월요일 0시
        return today - timedelta(days=today.weekday())
    return today


def usage(db, user) -> dict:
    """{"used", "limit", "period"}. 상한이 없으면 limit이 None"""
    if not user.ai_limit:
        return {"used": None, "limit": None, "period": None}
    used = db.query(aiusage_class).filter(
        aiusage_class.users_id == user.id,
        aiusage_class.created_at >= period_start(user.ai_period or "day"),
    ).count()
    return {"used": used, "limit": user.ai_limit, "period": user.ai_period or "day"}


def consume(db, user, kind: str):
    """상한 안이면 사용 기록을 한 줄 남기고, 넘었으면 QuotaExceeded"""
    if user is None:
        return
    info = usage(db, user)
    if info["limit"] is not None and info["used"] >= info["limit"]:
        when = "이번 주(월요일 0시에 초기화)" if info["period"] == "week" else "오늘(0시에 초기화)"
        raise QuotaExceeded(f"{when} AI 사용 횟수 {info['limit']}회를 모두 썼습니다.")
    db.add(aiusage_class(users_id=user.id, kind=kind))
    db.commit()
