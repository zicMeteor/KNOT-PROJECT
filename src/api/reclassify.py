from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from database.database import get_db
from pipeline.LLM_prompt import CATEGORIES
from services.agent_preview_service import ReclassifyPreview, ReclassifyExecute

class Reclassify_Request(BaseModel):
    purpose: str
    # 비우면 전체 자료가 대상
    categories: list[str] = []
    # 다음 묶음을 볼 때 앞 미리보기의 next_before_id를 그대로 넘긴다
    before_id: int | None = Field(default=None, ge=1)

class Execute_Request(BaseModel):
    actions: list

router = APIRouter()

@router.post("/agent/reclassify")
def create_agent(request: Execute_Request, db: Session = Depends(get_db)):
    try:
        return ReclassifyExecute(db, request.actions)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/reclassify/preview")
def create_reclassify_preview(request: Reclassify_Request, db: Session = Depends(get_db)):
    purpose = request.purpose.strip()
    if not purpose:
        raise HTTPException(status_code=400, detail="목적을 입력하세요.")
    unknown = [c for c in request.categories if c not in CATEGORIES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"없는 카테고리입니다: {', '.join(unknown)}")
    try:
        # 한 번에 검토하는 수는 Scope_Tool의 상한(REVIEW_LIMIT)이 정한다
        return ReclassifyPreview(db, request.categories, [], purpose, request.before_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))