import os
import tempfile

import settings
from database.models import agenthistory_class, content_class, contenttag_class
from pipeline.errors import ExtractionError
from pipeline.LLM_prompt import analyze_content
from pipeline.PDF_parser import extract_pdf_text
from pipeline.tag_utils import find_or_create_tag, get_tags_by_content, user_tag_pool
from pipeline.URL_parser import extract_url_text
from services import ai_quota

ANALYSIS_STATUSES = ("ai", "ai_short", "manual", "pending")


# URL 중복방지 (내 자료 안에서만)
def find_duplicate_url(db, url: str, users_id: int):
    base = url.strip().rstrip("/")
    return db.query(content_class).filter(
        content_class.users_id == users_id,
        content_class.URL.in_([base, base + "/"]),
    ).first()


def delete_content(db, users_id: int, content_id: int) -> dict | None:
    """내 자료 하나를 지운다. 남의 자료이거나 없으면 None
    태그 연결은 지우고, 재분류 이력은 결과보고서용으로 남긴다 (자료 번호만 비운다)
    지운 자료의 내용은 돌려줘서 기록에 남긴다"""
    content = db.query(content_class)\
        .filter(content_class.Content_id == content_id, content_class.users_id == users_id)\
        .first()
    if not content:
        return None
    removed = {
        "content_id": content.Content_id,
        "title": content.title,
        "url": content.URL,
        "category": content.category,
        "tags": get_tags_by_content(db, [content_id]).get(content_id, []),
        "analysis_status": content.analysis_status or "ai",
        "is_seed": bool(content.is_seed),
        "created_at": content.created_at.isoformat() if content.created_at else None,
    }
    try:
        db.query(contenttag_class).filter(contenttag_class.Content_id == content_id).delete()
        db.query(agenthistory_class).filter(agenthistory_class.Content_id == content_id)\
            .update({agenthistory_class.Content_id: None})
        db.delete(content)
        db.commit()
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"삭제 실패: {e}")
    return removed


def s_content(url, db, users_id, memo=None, title=None, category=None, tags=None, summary=None,
              source="url", analysis_status="ai"):
    # LLM 결과를 Content 테이블에 저장
    if source == "pdf":
        url = None  # PDF는 URL 없이 저장, 중복 검사도 하지 않음
    else:
        if not url or not url.strip():
            raise ValueError("URL이 필요합니다.")
        if find_duplicate_url(db, url, users_id):
            raise ExtractionError("DUPLICATE", "이미 저장된 URL입니다.")
    if analysis_status not in ANALYSIS_STATUSES:
        analysis_status = "ai"
    tags = tags or []

    try:
        content = content_class(
            users_id=users_id,
            title=title,
            category=category,
            source=source,
            summary=summary,
            URL=url,
            memo=memo,
            analysis_status=analysis_status,
        )
        db.add(content)
        db.flush()

        for tag_name in tags:
            existing_tag = find_or_create_tag(db, tag_name)

            content_tag = contenttag_class(
                Content_id=content.Content_id,
                Tag_id=existing_tag.Tag_id
            )
            db.add(content_tag)
        db.commit()

    except Exception as e:
        db.rollback()
        raise RuntimeError(f"DB 저장 실패: {str(e)}")
    return {
        "content_id": content.Content_id,
        "title": title,
        "category": category,
        "tags": tags,
        "summary": summary
    }


def analyze_text(text, title, db, user, short=False):
    """본문을 AI로 분석한다. 길면 앞부분만 보낸다 (MAX_TEXT_CHARS)"""
    tag_pool = user_tag_pool(db, user.id)
    truncated = len(text) > settings.MAX_TEXT_CHARS
    if truncated:
        text = text[: settings.MAX_TEXT_CHARS]

    ai_quota.consume(db, user, "analyze")
    # 실패 처리를 켜면 AI 오류(형식 오류 포함)는 한 번 더 시도한다. 사용량은 한 번만 센다
    attempts = 2 if settings.FAILURE_ASSIST else 1
    for attempt in range(attempts):
        try:
            result = analyze_content(text, tag_pool, short=short)
            break
        except Exception as e:
            if attempt + 1 >= attempts:
                raise RuntimeError(f"LLM 분석 실패: {str(e)}")
            print(f"LLM 분석 실패, 다시 시도: {e}")
    if result.get("insufficient"):
        raise ExtractionError("NO_TEXT", "요약할 만한 본문이 없는 페이지입니다.")

    tag_pool_set = set(t.lower() for t in tag_pool)
    tags = []
    for tag_name in result["tags"]:
        is_new = tag_name.strip().lower() not in tag_pool_set
        tags.append({"name": tag_name, "is_new": is_new})

    return {
        "title": title,
        "category": result["category"],
        "tags": tags,
        "summary": result["summary"],
        "category_fallback": result["category_fallback"],
        "char_count": len(text),
        "truncated": truncated,
        "analysis_status": "ai_short" if short else "ai",
    }


def analyze_content_preview(url, db, user, memo=None):
    if find_duplicate_url(db, url, user.id):
        raise ExtractionError("DUPLICATE", "이미 저장된 URL입니다.")

    try:
        result_url = extract_url_text(url)
    except ExtractionError:
        raise
    except Exception as e:
        print(f"URL 파싱 에러: {e}")
        raise ExtractionError("FETCH_FAIL", str(e))

    return analyze_text(result_url["text"], result_url["title"], db, user, short=result_url["short"])


def analyze_pasted_preview(text, title, db, user):
    """실패한 페이지의 본문을 사용자가 붙여 넣었을 때"""
    text = (text or "").strip()
    if len(text) < 30:
        raise ExtractionError("TOO_SHORT", "붙여 넣은 글이 너무 짧습니다 (30자 이상).")
    return analyze_text(text, title, db, user, short=len(text) < 300)


def analyze_pdf_preview(filename, data, db, user):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="knot_", suffix=".pdf", delete=False
        ) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        # with 블록이 끝나 핸들이 닫힌 뒤에 pymupdf가 연다

        try:
            extracted = extract_pdf_text(tmp_path)
        except ExtractionError:
            raise
        except Exception as e:
            print(f"PDF 파싱 에러: {e}")
            raise ExtractionError("NO_TEXT", f"PDF를 읽을 수 없습니다: {e}")
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError as e:
                print(f"임시 파일 삭제 실패: {e}")

    title = os.path.splitext(os.path.basename(filename))[0]
    return analyze_text(extracted["text"], title, db, user, short=extracted["short"])
