from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_search_service import AgentLoop

class Agent_Request(BaseModel):
    query: str

router = APIRouter()

@router.post("/agent/search")
def create_agent(request: Agent_Request, db: Session = Depends(get_db)):
    return AgentLoop(db, request.query)