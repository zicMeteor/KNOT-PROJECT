import json
import time

from database.database import SessionLocal
from database.models import eventlog_class


def ms_since(started):
    """time.perf_counter()로 잰 시작 시각부터 지금까지 밀리초"""
    return int((time.perf_counter() - started) * 1000)


def log_event(event, ok, ms=None, **detail):
    """시연 결과보고서용 기록을 한 줄 남긴다.

    요청을 처리하던 세션과 따로 새 세션을 쓴다. 저장이 실패해 롤백되어도 기록은 남고,
    기록이 실패해도 원래 요청에는 영향이 없다 (예외를 밖으로 던지지 않는다).
    """
    db = SessionLocal()
    try:
        db.add(
            eventlog_class(
                event=event,
                ok=ok,
                ms=ms,
                detail=json.dumps(detail, ensure_ascii=False, default=str),
            )
        )
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"이벤트 기록 실패: {e}")
    finally:
        db.close()
