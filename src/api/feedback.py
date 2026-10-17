# AI 결과마다 누르는 좋아요·싫어요, 화면에서만 알 수 있는 사용 기록 (검색 결과 열람)
import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import feedback_class
from services.auth import CurrentUser, current_user
from services.event_log import log_event


class Feedback_Request(BaseModel):
    target: Literal["analysis", "search", "reclassify"]
    value: Literal[1, -1]
    ref: Optional[str] = Field(default=None, max_length=2083)
    detail: dict = {}


class Event_Request(BaseModel):
    # 화면이 남길 수 있는 기록은 이것만 받는다
    # search_open: AI 검색 결과를 열었다 / library_open: 전체 자료에서 자료를 열었다
    # graph_tag_open: 지식 그래프에서 태그를 골랐다 / graph_item_open: 그래프의 태그·실 목록에서 자료를 열었다
    event: Literal["search_open", "library_open", "graph_tag_open", "graph_item_open"]
    detail: dict = {}


# log_event가 따로 받는 이름이라 detail에 들어 있으면 인자가 겹쳐 500이 난다
RESERVED_KEYS = {"event", "ok", "ms", "users_id"}

router = APIRouter()


@router.post("/feedback")
def add_feedback(request: Feedback_Request, db: Session = Depends(get_db),
                 user: CurrentUser = Depends(current_user)):
    db.add(feedback_class(
        users_id=user.id, target=request.target, value=request.value, ref=request.ref,
        detail=json.dumps(request.detail, ensure_ascii=False, default=str)[:20000],
    ))
    db.commit()
    return {"ok": True}


@router.post("/events")
def add_event(request: Event_Request, user: CurrentUser = Depends(current_user)):
    # 값은 짧은 글자·숫자만 남긴다 (검색어가 길어도 200자까지)
    detail = {
        k: (v[:200] if isinstance(v, str) else v)
        for k, v in list(request.detail.items())[:10]
        if k not in RESERVED_KEYS and (isinstance(v, (str, int, float, bool)) or v is None)
    }
    log_event(request.event, True, None, users_id=user.id, **detail)
    return {"ok": True}
