import os
import time
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import settings
from database.database import get_db
from database.models import content_class
from pipeline.errors import ExtractionError
from pipeline.tag_utils import get_tags_by_content
from services import pdf_store
from services.ai_quota import QuotaExceeded
from services.auth import CurrentUser, current_user
from services.content_service import (
    s_content, delete_content, analyze_content_preview, analyze_pdf_preview, analyze_pasted_preview,
    reanalyze_content_preview, update_content, get_my_content,
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
    # 어떻게 저장까지 왔는지 (기록용): 보통 분석, 실패 뒤 붙여넣기, 실패 뒤 메모 저장
    via: Literal["analyze", "paste", "manual"] = "analyze"

class Edit_Request(BaseModel):  # 저장한 자료 고치기
    title: Optional[str] = None
    category: str
    tags: list[str]
    memo: Optional[str] = None
    # 다시 분석한 결과를 반영할 때만 넘긴다 (요약과 분석 상태도 바뀐다). 비우면 그대로 둔다
    summary: Optional[str] = None
    analysis_status: Optional[Literal["ai", "ai_short"]] = None

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
    headers = {"X-Error-Code": code}
    # 이미 저장한 주소면 그 자료 번호도 알려 준다 (화면의 "저장한 자료 보기")
    if getattr(err, "content_id", None):
        headers["X-Content-Id"] = str(err.content_id)
    raise HTTPException(status_code=http_status, detail=str(err), headers=headers)


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
    detail = {"source": request.source, "url": request.url, "analysis_status": request.analysis_status, "via": request.via}
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
        content_id=result.get("content_id"), category=request.category, tags=len(result["tags"]),
        **detail, **_edit_diff(request.suggested, request.category, request.tags),
    )
    return result

@router.post("/content/discard")
def discard_content(request: Discard_Request, user: CurrentUser = Depends(current_user)):
    # DB의 자료는 바꾸지 않는다. "분석했지만 저장하지 않고 취소함"만 기록한다
    log_event("discard", True, None, users_id=user.id, source=request.source, url=request.url, title=request.title)
    return {"ok": True}

@router.delete("/content/{content_id}")
def delete_content_route(content_id: int, db: Session = Depends(get_db),
                         user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        removed = delete_content(db, user.id, content_id)
    except RuntimeError as e:
        _fail("delete", started, e, 500, user, content_id=content_id)
    if removed is None:
        # 남의 자료 번호도 "없음"으로 답한다 (있는지 없는지 알려 주지 않는다)
        raise HTTPException(status_code=404, detail="없는 자료입니다.", headers={"X-Error-Code": "NOT_FOUND"})
    log_event("delete", True, ms_since(started), users_id=user.id, **removed)
    return {"ok": True, "content_id": content_id}

@router.patch("/content/{content_id}")
def update_content_route(content_id: int, request: Edit_Request, db: Session = Depends(get_db),
                         user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        result = update_content(
            db, user.id, content_id, request.title, request.category, request.tags, request.memo,
            request.summary, request.analysis_status,
        )
    except ValueError as e:
        _fail("edit", started, e, 400, user, content_id=content_id)
    except RuntimeError as e:
        _fail("edit", started, e, 500, user, content_id=content_id)
    if result is None:
        raise HTTPException(status_code=404, detail="없는 자료입니다.", headers={"X-Error-Code": "NOT_FOUND"})
    log_event(
        "edit", True, ms_since(started), users_id=user.id, content_id=content_id,
        changed=result["changed"], reanalyzed=request.analysis_status is not None,
    )
    return result

@router.post("/content/{content_id}/analyze")
def reanalyze_content_route(content_id: int, db: Session = Depends(get_db),
                            user: CurrentUser = Depends(current_user)):
    started = time.perf_counter()
    try:
        result = reanalyze_content_preview(db, user, content_id)
    except (ValueError, QuotaExceeded) as e:
        _fail("reanalyze", started, e, 400, user, content_id=content_id)
    except RuntimeError as e:
        _fail("reanalyze", started, e, 500, user, content_id=content_id)
    if result is None:
        raise HTTPException(status_code=404, detail="없는 자료입니다.", headers={"X-Error-Code": "NOT_FOUND"})
    log_event("reanalyze", True, ms_since(started), users_id=user.id, content_id=content_id, **_analysis_log(result))
    return result

def _my_pdf_content(db, user, content_id):
    """내 PDF 자료. 남의 자료이거나 없으면 404, 링크 자료면 400"""
    content = get_my_content(db, user.id, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="없는 자료입니다.", headers={"X-Error-Code": "NOT_FOUND"})
    if content.URL:
        raise HTTPException(status_code=400, detail="링크로 저장한 자료에는 PDF를 올릴 수 없습니다.")
    return content

@router.put("/content/{content_id}/file")
def upload_pdf_route(content_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                     user: CurrentUser = Depends(current_user)):
    """저장한 PDF 자료에 원본 파일을 붙인다 (이미 있으면 바꾼다)"""
    content = _my_pdf_content(db, user, content_id)
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 올릴 수 있습니다.")
    limit = settings.MAX_PDF_MB * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=400, detail=f"PDF는 {settings.MAX_PDF_MB}MB까지 넣을 수 있습니다.",
                            headers={"X-Error-Code": "PDF_TOO_BIG"})
    if not data.startswith(pdf_store.PDF_MAGIC):
        raise HTTPException(status_code=400, detail="PDF 파일이 아닙니다.")
    try:
        pdf_store.save(pdf_store.path_of(content), data)
    except OSError as e:
        print(f"PDF 파일 저장 실패: {e}")
        raise HTTPException(status_code=500, detail="PDF 파일을 저장하지 못했습니다.")
    log_event("pdf_upload", True, None, users_id=user.id, content_id=content_id, size=len(data))
    return {"ok": True, "content_id": content_id}

@router.get("/content/{content_id}/file")
def open_pdf_route(content_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(current_user)):
    """보관한 PDF 원본을 브라우저에서 바로 연다"""
    content = _my_pdf_content(db, user, content_id)
    path = pdf_store.path_of(content)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="원본 PDF가 없습니다.", headers={"X-Error-Code": "NOT_FOUND"})
    name = quote(f"{content.title or 'document'}.pdf")
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            # 내려받지 않고 브라우저의 PDF 보기로 연다. 한글 제목은 filename*로 넘긴다
            "Content-Disposition": f"inline; filename*=UTF-8''{name}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-cache",
        },
    )

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
            # PDF 자료의 원본을 열 수 있는지 (보관 기능 전에 저장한 PDF는 없다)
            "has_file": pdf_store.has_original(user.id, content.Content_id, content.URL, content.created_at),
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
