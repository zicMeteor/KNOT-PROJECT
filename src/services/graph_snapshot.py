# 계정별 그래프 상태를 하루 한 줄 남긴다 (자료 수, 태그 수, 선 수, 이어지지 않은 태그 수)
# 그날 그 계정의 첫 요청 때 한 번만 센다. 실패해도 요청에는 영향이 없다
import threading
from datetime import date

from sqlalchemy import text

from database.database import SessionLocal
from database.models import graphsnapshot_class

_done: set[tuple[int, date]] = set()
_lock = threading.Lock()


def graph_stats(db, users_id: int) -> dict:
    contents = db.execute(
        text("SELECT COUNT(*) FROM content WHERE users_id = :uid"), {"uid": users_id}
    ).scalar() or 0
    tag_ids = {
        row[0]
        for row in db.execute(
            text("""
                SELECT DISTINCT ct.Tag_id FROM contenttag ct
                JOIN content c ON c.Content_id = ct.Content_id
                WHERE c.users_id = :uid
            """),
            {"uid": users_id},
        )
    }
    pairs = db.execute(
        text("""
            SELECT DISTINCT ct1.Tag_id, ct2.Tag_id FROM contenttag ct1
            JOIN contenttag ct2 ON ct2.Content_id = ct1.Content_id AND ct1.Tag_id < ct2.Tag_id
            JOIN content c ON c.Content_id = ct1.Content_id
            WHERE c.users_id = :uid
        """),
        {"uid": users_id},
    ).fetchall()
    linked = {a for a, _ in pairs} | {b for _, b in pairs}
    return {
        "contents": int(contents),
        "tags": len(tag_ids),
        "links": len(pairs),
        "isolated": len(tag_ids - linked),
    }


def ensure_today(_db, users_id: int):
    key = (users_id, date.today())
    with _lock:
        if key in _done:
            return
        _done.add(key)
    db = SessionLocal()
    try:
        exists = db.query(graphsnapshot_class.GraphSnapshot_id).filter(
            graphsnapshot_class.users_id == users_id, graphsnapshot_class.day == key[1]
        ).first()
        if not exists:
            db.add(graphsnapshot_class(users_id=users_id, day=key[1], **graph_stats(db, users_id)))
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"그래프 기록 실패: {e}")
    finally:
        db.close()
