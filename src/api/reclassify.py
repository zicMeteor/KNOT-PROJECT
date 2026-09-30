from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_reclassify_service import ReclassifyAgent

class Reclassify_Request(BaseModel):
    allowed_categories: list[str]
    allowed_tags: list[str]
    purpose: str

router = APIRouter()

@router.post("/agent/reclassify")
def create_agent(request: Reclassify_Request, db: Session = Depends(get_db)):
    return ReclassifyAgent(db, request.allowed_categories, request.allowed_tags, request.purpose)