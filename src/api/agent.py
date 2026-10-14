import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from services.agent_search_service import AgentLoop
from services.ai_quota import QuotaExceeded
from services.auth import CurrentUser, current_user
from services.event_log import log_event, ms_since

class Agent_Request(BaseModel):
    query: str

router = APIRouter()

@router.post("/agent/search")
def create_agent(request: Agent_Request, db: Session = Depends(get_db),
                 user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        result = AgentLoop(db, user, request.query)
    except QuotaExceeded as e:
        log_event("search", False, ms_since(started), users_id=user.id, query=request.query, code="AI_QUOTA", error=str(e))
        raise HTTPException(status_code=429, detail=str(e), headers={"X-Error-Code": "AI_QUOTA"})
    except ValueError as e:
        log_event("search", False, ms_since(started), users_id=user.id, query=request.query, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("search", False, ms_since(started), users_id=user.id, query=request.query, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    log_event(
        "search", True, ms_since(started), users_id=user.id, query=request.query, count=result.get("count"),
        tags=result.get("analysis", {}).get("tags"), keywords=result.get("analysis", {}).get("keywords"),
    )
    return result
