from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import tag_class, content_class, contenttag_class
from services.content_service import s_content, analyze_content_preview, analyze_pdf_preview
from typing import Literal, Optional

class Analyze_Request(BaseModel):  # analyze용 — url + memo만
    url: str
    memo: Optional[str] = None

class Content_Request(BaseModel):  # 저장용
    url: Optional[str] = None  
    source: Literal["url", "pdf"] = "url"
    memo: Optional[str] = None
    title: Optional[str] = None
    category: str
    tags: list[str]
    summary: str
router = APIRouter()

@router.post("/content")
def create_content(request: Content_Request, db: Session = Depends(get_db)):
    try:
        return s_content(
            request.url, db, request.memo,
            request.title, request.category, request.tags, request.summary,
            request.source,
        )
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
            "title": content.title,
            "Content_id": content.Content_id,
            "category": content.category,
            "summary": content.summary,
            "URL": content.URL,
            "tags": tag_names,
            "memo": content.memo
        })
    
    return result
    
@router.post("/content/analyze")
def analyze_content_route(request: Analyze_Request, db: Session = Depends(get_db)):
    try:
        return analyze_content_preview(request.url, db, request.memo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/content/analyze-pdf")
def analyze_pdf_route(
    file: UploadFile = File(...),
    memo: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    try:
        return analyze_pdf_preview(filename, data, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


    
    
    

