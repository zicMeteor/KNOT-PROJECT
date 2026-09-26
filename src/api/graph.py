from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from services.graph_service import get_category_overview, get_tags_category, get_contents_tag

router = APIRouter()

@router.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    try:
        return get_category_overview(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/category/{category}")
def get_ca_graph(category: str, db: Session = Depends(get_db)):
    try:
        return get_tags_category(db, category)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/graph/tag/{tag_name}/contents")
def get_content_graph(tag_name: str,db: Session = Depends(get_db)):
    try:
        return get_contents_tag(db, tag_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    



    




    
    
    

