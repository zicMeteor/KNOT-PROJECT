from pipeline.URL_parser import extract_url_text
from pipeline.LLM_prompt import analyze_content
from database.models import tag_class, content_class, contenttag_class
from pipeline.tag_utils import find_or_create_tag


def s_content(url, db, memo=None, title=None, category=None, tags=None, summary=None):
    # LLM 결과를 Content 테이블에 저장
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


def analyze_content_preview(url, db, memo=None):
    try:
        result_url = extract_url_text(url)
        text = result_url["text"]
        title = result_url["title"]
        
    except Exception as e:
        print(f"URL 파싱 에러: {e}")
        raise ValueError(str(e))
    
    tag_pool = []
    for tag in db.query(tag_class).all():
        tag_pool.append(tag.Name)
        
    try:
        result = analyze_content(text, tag_pool)
    except Exception as e:
        raise RuntimeError(f"LLM 분석 실패: {str(e)}")
    
    tags = []
    tag_pool_set = set(tag_pool)
    for tag_name in result["tags"]:
        is_new = tag_name not in tag_pool_set
        tags.append({"name": tag_name, "is_new": is_new})
    
    return {
        "title": title,
        "category": result["category"],
        "tags": tags,
        "summary": result["summary"],
        "char_count": len(text)
    }
    