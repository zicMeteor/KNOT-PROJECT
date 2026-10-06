from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_preview_service import ReclassifyPreview, ReclassifyExecute

class Reclassify_Request(BaseModel):
    purpose: str

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
    try:
        # 필터 없이 전체 자료가 대상. 범위는 Scope_Tool의 상한이 정한다
        return ReclassifyPreview(db, [], [], purpose)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))