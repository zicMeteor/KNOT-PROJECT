from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.database import get_db
from services.graph_service import get_category_overview, get_tags_category, get_contents_tag

router = APIRouter()

@router.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    result = get_category_overview(db)
    
    return result

@router.get("/graph/category/{category}")
def get_ca_graph(category: str, db: Session = Depends(get_db)):
    tag_re = get_tags_category(db, category)
    
    return tag_re

@router.get("/graph/tag/{tag_name}/contents")
def get_content_graph(tag_name: str,db: Session = Depends(get_db)):
    content_re = get_contents_tag(db,tag_name)
    return content_re
    



    




    
    
    

