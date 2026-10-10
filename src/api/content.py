import time
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import tag_class, content_class, contenttag_class
from services.content_service import s_content, analyze_content_preview, analyze_pdf_preview
from services.event_log import log_event, ms_since
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
class Discard_Request(BaseModel):  # 분석 결과를 저장하지 않고 취소했을 때 (결과보고서용 기록만 남긴다)
    source: Literal["url", "pdf"] = "url"
    url: Optional[str] = None
    title: Optional[str] = None

router = APIRouter()

@router.post("/content")
def create_content(request: Content_Request, db: Session = Depends(get_db)):
    started = time.perf_counter()
    try:
        result = s_content(
            request.url, db, request.memo,
            request.title, request.category, request.tags, request.summary,
            request.source,
        )
    except ValueError as e:
        log_event("save", False, ms_since(started), source=request.source, url=request.url, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("save", False, ms_since(started), source=request.source, url=request.url, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    log_event(
        "save", True, ms_since(started),
        source=request.source, url=request.url, content_id=result.get("content_id"),
        category=request.category, tags=len(request.tags),
    )
    return result

@router.post("/content/discard")
def discard_content(request: Discard_Request):
    # DB의 자료는 바꾸지 않는다. "분석했지만 저장하지 않고 취소함"만 기록한다
    log_event("discard", True, None, source=request.source, url=request.url, title=request.title)
    return {"ok": True}

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
            "memo": content.memo,
            "created_at": content.created_at
        })
    
    return result
    
@router.post("/content/analyze")
def analyze_content_route(request: Analyze_Request, db: Session = Depends(get_db)):
    started = time.perf_counter()
    try:
        result = analyze_content_preview(request.url, db, request.memo)
    except ValueError as e:
        # 이미 저장된 URL("이미 저장된 URL입니다.")도 여기로 온다
        log_event("analyze_url", False, ms_since(started), url=request.url, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("analyze_url", False, ms_since(started), url=request.url, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    log_event(
        "analyze_url", True, ms_since(started),
        url=request.url, category=result["category"],
        category_fallback=result.get("category_fallback"),
        tags=len(result["tags"]), new_tags=sum(1 for t in result["tags"] if t["is_new"]),
    )
    return result
    
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

    started = time.perf_counter()
    try:
        result = analyze_pdf_preview(filename, data, db)
    except ValueError as e:
        log_event("analyze_pdf", False, ms_since(started), filename=filename, size=len(data), error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        log_event("analyze_pdf", False, ms_since(started), filename=filename, size=len(data), error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
    log_event(
        "analyze_pdf", True, ms_since(started),
        filename=filename, size=len(data), category=result.get("category"),
        category_fallback=result.get("category_fallback"),
        tags=len(result.get("tags", [])), new_tags=sum(1 for t in result.get("tags", []) if t.get("is_new")),
    )
    return result


    
    
    

