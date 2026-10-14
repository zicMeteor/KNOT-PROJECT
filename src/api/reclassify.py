import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Literal, Optional
from database.database import get_db
from pipeline.LLM_prompt import CATEGORIES
from services.agent_preview_service import ReclassifyPreview, ReclassifyExecute
from services.ai_quota import QuotaExceeded
from services.auth import CurrentUser, current_user
from services.event_log import log_event, ms_since

class Reclassify_Request(BaseModel):
    purpose: str
    # 비우면 전체 자료가 대상
    categories: list[str] = []
    # 다음 묶음을 볼 때 앞 미리보기의 next_before_id를 그대로 넘긴다
    before_id: int | None = Field(default=None, ge=1)

class Execute_Request(BaseModel):
    actions: list
    # 이력에 남길 목적과 시작 방식 (직접 / 자동 제안)
    purpose: Optional[str] = None
    trigger: Literal["manual", "auto"] = "manual"

router = APIRouter()

@router.post("/agent/reclassify")
def create_agent(request: Execute_Request, db: Session = Depends(get_db),
                 user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        result = ReclassifyExecute(db, user, request.actions, request.purpose, request.trigger)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    statuses = [r["status"] for r in result["results"]]
    log_event(
        "reclassify_apply", True, ms_since(started), users_id=user.id, run_id=result["run_id"], purpose=request.purpose,
        trigger=request.trigger, applied=statuses.count("success"), skipped=statuses.count("skipped"),
        failed=statuses.count("failed"),
    )
    return result

@router.post("/agent/reclassify/preview")
def create_reclassify_preview(request: Reclassify_Request, db: Session = Depends(get_db),
                              user: CurrentUser = Depends(current_user)):
    purpose = request.purpose.strip()
    if not purpose:
        raise HTTPException(status_code=400, detail="목적을 입력하세요.")
    unknown = [c for c in request.categories if c not in CATEGORIES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"없는 카테고리입니다: {', '.join(unknown)}")
    started = time.perf_counter()
    detail = {"purpose": purpose, "categories": request.categories, "before_id": request.before_id}
    try:
        # 한 번에 검토하는 수는 Scope_Tool의 상한(REVIEW_LIMIT)이 정한다
        result = ReclassifyPreview(db, user, request.categories, [], purpose, request.before_id)
    except QuotaExceeded as e:
        log_event("reclassify_preview", False, ms_since(started), users_id=user.id, code="AI_QUOTA", **detail)
        raise HTTPException(status_code=429, detail=str(e), headers={"X-Error-Code": "AI_QUOTA"})
    except ValueError as e:
        log_event("reclassify_preview", False, ms_since(started), users_id=user.id, error=str(e), **detail)
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("reclassify_preview", False, ms_since(started), users_id=user.id, error=str(e), **detail)
        raise HTTPException(status_code=500, detail=str(e))
    log_event(
        "reclassify_preview", True, ms_since(started), users_id=user.id, reviewed=result["reviewed"],
        proposed=sum(1 for a in result["actions"] if a["change_needed"]), **detail,
    )
    return result
