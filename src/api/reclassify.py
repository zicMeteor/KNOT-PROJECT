from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_preview_service import ReclassifyPreview, ReclassifyExecute

class Reclassify_Request(BaseModel):
    allowed_categories: list[str]
    allowed_tags: list[str]
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
    try:
        return ReclassifyPreview(db, request.allowed_categories, request.allowed_tags, request.purpose)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))