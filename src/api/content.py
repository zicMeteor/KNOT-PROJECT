import time
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

import settings
from database.database import get_db
from database.models import content_class
from pipeline.errors import ExtractionError
from pipeline.tag_utils import get_tags_by_content
from services.ai_quota import QuotaExceeded
from services.auth import CurrentUser, current_user
from services.content_service import (
    s_content, analyze_content_preview, analyze_pdf_preview, analyze_pasted_preview,
)
from services.event_log import log_event, ms_since
from typing import Literal, Optional

class Analyze_Request(BaseModel):  # analyze용 — url + memo만
    url: str
    memo: Optional[str] = None

class Paste_Request(BaseModel):  # 실패한 페이지의 본문을 붙여 넣어 분석
    text: str
    url: Optional[str] = None
    title: Optional[str] = None

class Suggested(BaseModel):  # AI가 처음 제안한 값 (저장 전에 사용자가 고쳤는지 기록하려고)
    category: Optional[str] = None
    tags: list[str] = []

class Content_Request(BaseModel):  # 저장용
    url: Optional[str] = None
    source: Literal["url", "pdf"] = "url"
    memo: Optional[str] = None
    title: Optional[str] = None
    category: str
    tags: list[str]
    summary: Optional[str] = None
    # ai = 보통, ai_short = 짧은 본문, manual = 직접 입력, pending = 분석 대기
    analysis_status: Literal["ai", "ai_short", "manual", "pending"] = "ai"
    suggested: Optional[Suggested] = None

class Discard_Request(BaseModel):  # 분석 결과를 저장하지 않고 취소했을 때 (결과보고서용 기록만 남긴다)
    source: Literal["url", "pdf"] = "url"
    url: Optional[str] = None
    title: Optional[str] = None

router = APIRouter()


def _fail(event, started, err, http_status, user, **detail):
    """실패를 기록하고 HTTP 오류로 바꾼다. 화면은 X-Error-Code로 실패 이유를 구분한다"""
    code = getattr(err, "code", None)
    if isinstance(err, QuotaExceeded):
        code, http_status = "AI_QUOTA", 429
    elif code is None:
        code = "AI_FAIL" if http_status == 500 else "INVALID"
    log_event(event, False, ms_since(started), users_id=user.id, code=code, error=str(err), **detail)
    raise HTTPException(status_code=http_status, detail=str(err), headers={"X-Error-Code": code})


def _edit_diff(suggested: Optional[Suggested], category: str, tags: list[str]) -> dict:
    """AI 제안과 실제 저장값의 차이 (AI 제안 수정률 계산용)"""
    if suggested is None:
        return {}
    before = {t.strip().lower() for t in suggested.tags}
    after = {t.strip().lower() for t in tags}
    return {
        "category_changed": suggested.category is not None and suggested.category != category,
        "tags_added": len(after - before),
        "tags_removed": len(before - after),
    }


@router.post("/content")
def create_content(request: Content_Request, db: Session = Depends(get_db),
                   user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    detail = {"source": request.source, "url": request.url, "analysis_status": request.analysis_status}
    # 직접 입력·분석 대기 저장은 메모가 필수 (나중에 찾을 글자가 있어야 한다)
    if request.analysis_status in ("manual", "pending") and not (request.memo or "").strip():
        raise HTTPException(status_code=400, detail="메모를 입력하세요.", headers={"X-Error-Code": "MEMO_REQUIRED"})
    try:
        result = s_content(
            request.url, db, user.id, request.memo,
            request.title, request.category, request.tags, request.summary,
            request.source, request.analysis_status,
        )
    except ValueError as e:
        _fail("save", started, e, 400, user, **detail)
    except RuntimeError as e:
        _fail("save", started, e, 500, user, **detail)
    log_event(
        "save", True, ms_since(started), users_id=user.id,
        content_id=result.get("content_id"), category=request.category, tags=len(request.tags),
        **detail, **_edit_diff(request.suggested, request.category, request.tags),
    )
    return result

@router.post("/content/discard")
def discard_content(request: Discard_Request, user: CurrentUser = Depends(current_user)):
    # DB의 자료는 바꾸지 않는다. "분석했지만 저장하지 않고 취소함"만 기록한다
    log_event("discard", True, None, users_id=user.id, source=request.source, url=request.url, title=request.title)
    return {"ok": True}

@router.get("/content")
def get_contents(db: Session = Depends(get_db), user: CurrentUser = Depends(current_user)):
    contents = db.query(content_class).filter(content_class.users_id == user.id).all()
    # 태그는 한 번에 가져온다 (자료마다 따로 묻지 않게)
    tags_map = get_tags_by_content(db, [c.Content_id for c in contents])

    return [
        {
            "title": content.title,
            "Content_id": content.Content_id,
            "category": content.category,
            "summary": content.summary,
            "URL": content.URL,
            "tags": tags_map.get(content.Content_id, []),
            "memo": content.memo,
            "created_at": content.created_at,
            "analysis_status": content.analysis_status or "ai",
            "is_seed": bool(content.is_seed),
        }
        for content in contents
    ]

def _analysis_log(result):
    return dict(
        category=result["category"],
        category_fallback=result.get("category_fallback"),
        tags=len(result["tags"]), new_tags=sum(1 for t in result["tags"] if t["is_new"]),
        chars=result.get("char_count"), truncated=result.get("truncated"),
        analysis_status=result.get("analysis_status"),
    )

@router.post("/content/analyze")
def analyze_content_route(request: Analyze_Request, db: Session = Depends(get_db),
                          user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        result = analyze_content_preview(request.url, db, user, request.memo)
    except (ValueError, QuotaExceeded) as e:
        # 이미 저장된 URL("이미 저장된 URL입니다.")도 여기로 온다
        _fail("analyze_url", started, e, 400, user, url=request.url)
    except RuntimeError as e:
        _fail("analyze_url", started, e, 500, user, url=request.url)
    log_event("analyze_url", True, ms_since(started), users_id=user.id, url=request.url, **_analysis_log(result))
    return result

@router.post("/content/analyze-text")
def analyze_text_route(request: Paste_Request, db: Session = Depends(get_db),
                       user: CurrentUser = Depends(current_user)):
    if not settings.FAILURE_ASSIST:
        raise HTTPException(status_code=404, detail="사용할 수 없는 기능입니다.")
    started = time.perf_counter()
    detail = {"url": request.url, "pasted_chars": len(request.text or "")}
    try:
        result = analyze_pasted_preview(request.text, request.title, db, user)
    except (ValueError, QuotaExceeded) as e:
        _fail("analyze_paste", started, e, 400, user, **detail)
    except RuntimeError as e:
        _fail("analyze_paste", started, e, 500, user, **detail)
    log_event("analyze_paste", True, ms_since(started), users_id=user.id, **detail, **_analysis_log(result))
    return result

@router.post("/content/analyze-pdf")
def analyze_pdf_route(
    file: UploadFile = File(...),
    memo: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(current_user),
):
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드할 수 있습니다.")

    limit = settings.MAX_PDF_MB * 1024 * 1024
    data = file.file.read(limit + 1)
    if not data:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")
    started = time.perf_counter()
    if len(data) > limit:
        _fail("analyze_pdf", started,
              ExtractionError("PDF_TOO_BIG", f"PDF는 {settings.MAX_PDF_MB}MB까지 넣을 수 있습니다."),
              400, user, filename=filename)

    try:
        result = analyze_pdf_preview(filename, data, db, user)
    except (ValueError, QuotaExceeded) as e:
        _fail("analyze_pdf", started, e, 400, user, filename=filename, size=len(data))
    except RuntimeError as e:
        _fail("analyze_pdf", started, e, 500, user, filename=filename, size=len(data))
    log_event("analyze_pdf", True, ms_since(started), users_id=user.id, filename=filename, size=len(data), **_analysis_log(result))
    return result
