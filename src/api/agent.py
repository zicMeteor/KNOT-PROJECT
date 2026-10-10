import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_search_service import AgentLoop
from services.event_log import log_event, ms_since

class Agent_Request(BaseModel):
    query: str

router = APIRouter()

@router.post("/agent/search")
def create_agent(request: Agent_Request, db: Session = Depends(get_db)):
    started = time.perf_counter()
    try:
        result = AgentLoop(db, request.query)
    except ValueError as e:
        log_event("search", False, ms_since(started), query=request.query, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("search", False, ms_since(started), query=request.query, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    log_event("search", True, ms_since(started), query=request.query, count=result.get("count"))
    return result


