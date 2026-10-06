import os
import tempfile
from pipeline.URL_parser import extract_url_text
from pipeline.LLM_prompt import analyze_content
from database.models import tag_class, content_class, contenttag_class
from pipeline.tag_utils import find_or_create_tag
from pipeline.PDF_parser import extract_pdf_text

# URL 중복방지
def find_duplicate_url(db, url: str):
    base = url.strip().rstrip("/")
    return db.query(content_class).filter(
        content_class.URL.in_([base, base + "/"])
    ).first()

def s_content(url, db, memo=None, title=None, category=None, tags=None, summary=None):
    # LLM 결과를 Content 테이블에 저장
    if find_duplicate_url(db, url):
        raise ValueError("이미 저장된 URL입니다.")
    
    try:
        content = content_class(
            users_id=1,
            title=title,
            category=category,
            source="url",
            summary=summary,
            URL=url,
            memo=memo
        )
        db.add(content)
        db.flush()
        
        for tag_name in tags:
            existing_tag = find_or_create_tag(db, tag_name)

            content_tag = contenttag_class(
                Content_id = content.Content_id,
                Tag_id = existing_tag.Tag_id
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

def analyze_text(text, title, db):
    tag_pool = [tag.Name for tag in db.query(tag_class).all()]

    try:
        result = analyze_content(text, tag_pool)
    except Exception as e:
        raise RuntimeError(f"LLM 분석 실패: {str(e)}")

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
    }
    
def analyze_content_preview(url, db, memo=None):
    if find_duplicate_url(db, url):
        raise ValueError("이미 저장된 URL입니다.")

    try:
        result_url = extract_url_text(url)
        text = result_url["text"]
        title = result_url["title"]
    except Exception as e:
        print(f"URL 파싱 에러: {e}")
        raise ValueError(str(e))

    return analyze_text(text, title, db)

def analyze_pdf_preview(filename, data, db):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="knot_", suffix=".pdf", delete=False
        ) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        # with 블록이 끝나 핸들이 닫힌 뒤에 pymupdf가 연다

        try:
            text = extract_pdf_text(tmp_path)
        except Exception as e:
            print(f"PDF 파싱 에러: {e}")
            raise ValueError(f"PDF를 읽을 수 없습니다: {e}")
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError as e:
                print(f"임시 파일 삭제 실패: {e}")

    title = os.path.splitext(os.path.basename(filename))[0]
    return analyze_text(text, title, db)