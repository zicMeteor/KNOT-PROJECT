from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import tag_class, content_class, contenttag_class
from services.content_service import s_content
from typing import Optional

class Content_Request(BaseModel):
    url: str
    memo : Optional[str] = None

router = APIRouter()

@router.post("/content")
def create_content(request: Content_Request, db: Session = Depends(get_db)):
    try:
        return s_content(request.url, db, request.memo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/content")
def get_contents(db: Session = Depends(get_db)):
    contents = db.query(content_class).all()

    result = []
    
    for content in contents:
        content_tags = db.query(contenttag_class).filter(
            contenttag_class.Content_id == content.Content_id
        ).all()
        
        tag_names = []
        for ct in content_tags:
            tag = db.query(tag_class).filter(
                tag_class.Tag_id == ct.Tag_id
            ).first()
            tag_names.append(tag.Name)
            
        result.append({
            "Content_id": content.Content_id,
            "category": content.category,
            "summary": content.summary,
            "URL": content.URL,
            "tags": tag_names,
            "memo": content.memo
        })
    
    return result
    




    
    
    

