from pipeline.URL_parser import extract_url_text
from pipeline.LLM_prompt import analyze_content
from database.models import tag_class, content_class, contenttag_class
from pipeline.tag_utils import find_or_create_tag


def s_content(url, db):
    #본문 텍스트 가져옴
    try:
        result_url = extract_url_text(url)
        text = result_url["text"]
        title = result_url["title"]
        
    except Exception as e:
        print(f"URL 파싱 에러: {e}")
        raise ValueError(str(e))
    
    # 기존 캐그 목록 가져오기 -> LLM에 전달
    tag_pool = []
    for tag in db.query(tag_class).all():
        tag_pool.append(tag.Name)
        
    # LLM 분석
    try:
        result = analyze_content(text, tag_pool)
    except Exception as e:
        raise RuntimeError(f"LLM 분석 실패: {str(e)}")
    
    # LLM 결과를 Content 테이블에 저장
    try:
        content = content_class(
            users_id = 1,
            title=title,
            category = result["category"],
            source = "url",
            summary = result["summary"],
            URL = url
        )
        db.add(content)
        db.flush()
        
        for tag_name in result["tags"]:
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
    return result