import os
import re
import tempfile
from urllib.parse import parse_qsl, urlencode, urlsplit

import settings
from database.models import agenthistory_class, content_class, contenttag_class
from pipeline.errors import ExtractionError
from pipeline.LLM_prompt import CATEGORIES, analyze_content
from pipeline.PDF_parser import extract_pdf_text
from pipeline.tag_utils import find_or_create_tag, get_tags_by_content, user_tag_pool
from pipeline.URL_parser import extract_url_text
from services import ai_quota, pdf_store

ANALYSIS_STATUSES = ("ai", "ai_short", "manual", "pending")
# 사용자가 저장 전에 태그를 고칠 수 있으므로 서버에서도 확인한다
MAX_TAGS = 5
MAX_TAG_CHARS = 50
# summary 칸은 String(300). 메모는 화면 입력칸과 같은 상한 (TEXT 칸 한도보다 한참 작다)
MAX_SUMMARY_CHARS = 300
MAX_MEMO_CHARS = 2000


def check_lengths(summary, memo):
    """저장·고치기 공통: DB 칸에 들어가지 않는 길이는 저장 전에 거절한다 (DB 오류 500 대신 400)"""
    if summary and len(summary) > MAX_SUMMARY_CHARS:
        raise ValueError(f"요약은 {MAX_SUMMARY_CHARS}자까지 쓸 수 있습니다.")
    if memo and len(memo) > MAX_MEMO_CHARS:
        raise ValueError(f"메모는 {MAX_MEMO_CHARS}자까지 쓸 수 있습니다.")


def clean_tags(tags) -> list[str]:
    """앞뒤 공백을 지우고, 빈 태그와 대소문자만 다른 중복을 뺀다 (먼저 나온 것을 남김)"""
    out, seen = [], set()
    for tag in tags or []:
        name = (tag or "").strip()
        if not name or name.lower() in seen:
            continue
        if len(name) > MAX_TAG_CHARS:
            raise ValueError(f"태그는 {MAX_TAG_CHARS}자까지 쓸 수 있습니다.")
        seen.add(name.lower())
        out.append(name)
    if len(out) > MAX_TAGS:
        raise ValueError(f"태그는 {MAX_TAGS}개까지 붙일 수 있습니다.")
    return out


# 주소 끝에 붙어도 같은 페이지인 추적용 값 (utm_로 시작하는 값은 따로 뺀다)
# _bhlid·jwt_token: 뉴스레터(beehiiv) 메일 링크의 추적값과 구독자 자동 로그인 값. 메일로 연 주소와 웹 주소가 같은 글이다
TRACKING_PARAMS = {
    "fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "ref_src",
    "msclkid", "dclid", "yclid", "_hsenc", "_hsmi", "mkt_tok", "_bhlid", "jwt_token",
}


def url_key(url: str) -> str:
    """같은 페이지인지 비교할 때 쓰는 주소. http/https, www., 끝의 /, 추적용 값의 차이는 무시한다
    # 뒤는 페이지 안 위치라 무시하지만, #/·#!로 시작하면 페이지를 나누는 주소(해시 라우팅)라 남긴다"""
    raw = (url or "").strip()
    try:
        parts = urlsplit(raw)
        port = parts.port
    except ValueError:
        return raw
    host = (parts.hostname or "").lower().removeprefix("www.")
    port = f":{port}" if port and port not in (80, 443) else ""
    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in TRACKING_PARAMS
    ))
    route = f"#{parts.fragment}" if parts.fragment.startswith(("/", "!")) else ""
    return host + port + parts.path.rstrip("/") + (f"?{query}" if query else "") + route


# URL 중복방지 (내 자료 안에서만)
def find_duplicate_url(db, url: str, users_id: int):
    key = url_key(url)
    # 키의 맨 앞(도메인과 포트)만 쓴다. 경로·?·#이 바로 붙을 수 있다
    host = re.split(r"[/?#]", key, maxsplit=1)[0]
    # 같은 도메인의 자료만, 번호와 주소만 골라 와서 비교한다
    candidates = db.query(content_class.Content_id, content_class.URL).filter(
        content_class.users_id == users_id,
        content_class.URL.like(f"%{host}%"),
    ).all()
    return next((c for c in candidates if url_key(c.URL) == key), None)


def _duplicate(found):
    """이미 저장한 주소. 화면이 그 자료를 바로 열 수 있게 번호를 함께 넘긴다"""
    err = ExtractionError("DUPLICATE", "이미 저장된 URL입니다.")
    err.content_id = found.Content_id
    return err


def get_my_content(db, users_id: int, content_id: int):
    """내 자료 한 건. 남의 자료이거나 없으면 None (있는지 없는지 구분하지 않는다)"""
    return db.query(content_class)\
        .filter(content_class.Content_id == content_id, content_class.users_id == users_id)\
        .first()


def delete_content(db, users_id: int, content_id: int) -> dict | None:
    """내 자료 하나를 지운다. 남의 자료이거나 없으면 None
    태그 연결은 지우고, 재분류 이력은 결과보고서용으로 남긴다 (자료 번호만 비운다)
    지운 자료의 내용은 돌려줘서 기록에 남긴다"""
    content = get_my_content(db, users_id, content_id)
    if not content:
        return None
    pdf_path = pdf_store.path_of(content)
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
    pdf_store.remove(pdf_path)
    return removed


def s_content(url, db, users_id, memo=None, title=None, category=None, tags=None, summary=None,
              source="url", analysis_status="ai"):
    # LLM 결과를 Content 테이블에 저장
    if source == "pdf":
        url = None  # PDF는 URL 없이 저장, 중복 검사도 하지 않음
    else:
        if not url or not url.strip():
            raise ValueError("URL이 필요합니다.")
        found = find_duplicate_url(db, url, users_id)
        if found:
            raise _duplicate(found)
    if analysis_status not in ANALYSIS_STATUSES:
        analysis_status = "ai"
    if category not in CATEGORIES:
        raise ValueError("카테고리를 고르세요.")
    title = (title or "").strip() or None
    if analysis_status in ("manual", "pending") and not title:
        raise ValueError("제목을 입력하세요.")
    tags = clean_tags(tags)
    check_lengths(summary, memo)

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


def _analyze_url(url, db, user):
    try:
        result_url = extract_url_text(url)
    except ExtractionError:
        raise
    except Exception as e:
        # 오류 원문은 화면에 그대로 보이므로 서버 로그에만 남긴다
        print(f"URL 파싱 에러: {e}")
        raise ExtractionError("FETCH_FAIL", "페이지를 불러오지 못했습니다 (접속이 막혔거나 시간이 초과됨)")

    return analyze_text(result_url["text"], result_url["title"], db, user, short=result_url["short"])


def analyze_content_preview(url, db, user, memo=None):
    found = find_duplicate_url(db, url, user.id)
    if found:
        raise _duplicate(found)
    return _analyze_url(url, db, user)


def reanalyze_content_preview(db, user, content_id):
    """AI 없이 저장한 내 자료를 다시 분석한다 (저장은 하지 않는다). 남의 자료이거나 없으면 None
    링크는 주소를 다시 읽고, PDF는 보관한 원본을 읽는다"""
    content = get_my_content(db, user.id, content_id)
    if not content:
        return None
    if content.URL:
        return _analyze_url(content.URL, db, user)
    path = pdf_store.path_of(content)
    if not os.path.isfile(path):
        raise ValueError("원본 PDF가 없어 다시 분석할 수 없습니다. 전체 자료에서 PDF를 올린 뒤 다시 시도하세요.")
    return _analyze_pdf_path(path, content.title, db, user)


def update_content(db, users_id, content_id, title, category, tags, memo, summary=None, analysis_status=None):
    """내 자료의 제목·카테고리·태그·메모를 고친다. 남의 자료이거나 없으면 None
    analysis_status를 넘기면 다시 분석한 결과로 보고 요약과 분석 상태도 바꾼다"""
    content = get_my_content(db, users_id, content_id)
    if not content:
        return None
    if category not in CATEGORIES:
        raise ValueError("카테고리를 고르세요.")
    tags = clean_tags(tags)
    title = (title or "").strip() or None
    memo = (memo or "").strip() or None
    status = analysis_status or content.analysis_status or "ai"
    if status in ("manual", "pending"):
        # 저장할 때와 같은 규칙: AI 요약이 없는 자료는 제목과 메모로 찾는다
        if not title:
            raise ValueError("제목을 입력하세요.")
        if not memo:
            raise ValueError("메모를 입력하세요.")
    if analysis_status is not None:
        # AI 분석 결과로 바꾸는 것이므로 요약이 있어야 한다 (없으면 요약 없는 "AI 분석" 자료가 된다)
        summary = (summary or "").strip()
        if not summary:
            raise ValueError("분석 결과의 요약이 없습니다. 다시 분석해 주세요.")
    check_lengths(summary if analysis_status is not None else None, memo)

    before = {
        "title": content.title,
        "category": content.category,
        "tags": get_tags_by_content(db, [content_id])[content_id],
        "memo": content.memo,
        "analysis_status": content.analysis_status or "ai",
    }
    try:
        content.title = title
        content.category = category
        content.memo = memo
        if analysis_status is not None:
            content.summary = summary
            content.analysis_status = analysis_status
        db.query(contenttag_class).filter(contenttag_class.Content_id == content_id).delete()
        for tag_name in tags:
            tag = find_or_create_tag(db, tag_name)
            db.add(contenttag_class(Content_id=content_id, Tag_id=tag.Tag_id))
        db.commit()
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"DB 저장 실패: {str(e)}")

    after = {"title": title, "category": category, "tags": tags, "memo": memo, "analysis_status": status}
    return {
        "content_id": content_id,
        "title": title,
        "category": category,
        "tags": tags,
        "memo": memo,
        "summary": content.summary,
        "analysis_status": status,
        # 기록용: 무엇을 바꿨는지 (태그는 대소문자·순서 무시)
        "changed": [
            k for k in after
            if (k == "tags" and {t.lower() for t in before[k]} != {t.lower() for t in after[k]})
            or (k != "tags" and before[k] != after[k])
        ],
    }


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

        title = os.path.splitext(os.path.basename(filename))[0]
        return _analyze_pdf_path(tmp_path, title, db, user)
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError as e:
                print(f"임시 파일 삭제 실패: {e}")


def _analyze_pdf_path(path, title, db, user):
    try:
        extracted = extract_pdf_text(path)
    except ExtractionError:
        raise
    except Exception as e:
        print(f"PDF 파싱 에러: {e}")
        raise ExtractionError("NO_TEXT", f"PDF를 읽을 수 없습니다: {e}")
    return analyze_text(extracted["text"], title, db, user, short=extracted["short"])
