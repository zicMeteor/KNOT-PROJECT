from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import content_class, contenttag_class
from services.graph_service import s_graph

router = APIRouter()

@router.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    result = s_graph(db)
    
    return result


    




    
    
    

