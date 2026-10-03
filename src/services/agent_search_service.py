from typing import Optional
# from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from pipeline.LLM_search import analyze_search_query
from sqlalchemy import text
from sqlalchemy import or_

def ContentTool(db, category: Optional[str], tags: list[str]):
    query = db.query(content_class)
    
    if category :
        query = query.filter(content_class.category == category)
    
    if tags:
        query = query.join(contenttag_class, content_class.Content_id == contenttag_class.Content_id)\
                    .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
                    .filter(tag_class.Name_lower.in_([t.lower() for t in tags]))\
                    .distinct()
        
    search_results = query.all()
    contents = []
    for sea_cont in search_results:
        
        contents.append({
            "content_id": sea_cont.Content_id,
            "title": sea_cont.title,
            "category" : sea_cont.category,
            "summary": sea_cont.summary,
            "URL" : sea_cont.URL,
            "created_at" : sea_cont.created_at
        })
    return {"contents": contents, "count": len(contents)}

def KeywordTool(db, keywords: list[str]):
    if not keywords:
        return {"contents": [], "count": 0}
    
    conditions = []
    for k in keywords:
        conditions.append(content_class.title.like(f"%{k}%"))
        conditions.append(content_class.summary.like(f"%{k}%"))
        conditions.append(content_class.memo.like(f"%{k}%"))
    
    rows = db.query(content_class).filter(or_(*conditions)).all()
    
    contents = []
    for row in rows:
        contents.append({            
            "content_id": row.Content_id,
            "title": row.title,
            "category" : row.category,
            "summary": row.summary,
            "URL" : row.URL,
            "created_at" : row.created_at
        })
    
    return {"contents": contents, "count": len(contents)}
        
def RelatedTagTool(db, tag_name: str):
    sql = text("""
        SELECT t2.Name, COUNT(*) as co_count
        FROM contenttag ct1
        JOIN tag t1 ON t1.Tag_id = ct1.Tag_id
        JOIN contenttag ct2 ON ct2.Content_id = ct1.Content_id
        JOIN tag t2 ON t2.Tag_id = ct2.Tag_id
        WHERE t1.Name = :tag_name
        AND t2.Name != :tag_name
        GROUP BY t2.Name
        ORDER BY co_count DESC
        LIMIT 3
    """)
    
    results = db.execute(sql, {"tag_name": tag_name}).fetchall()
    related_tags = [row[0] for row in results]
    return {"related_tags": related_tags}

def AgentLoop(db, query: str):
    
    tag_pool = []
    for tag_row in db.query(tag_class.Name).all():
        tag_pool.append(tag_row[0])

    llm_result = analyze_search_query(query, tag_pool=tag_pool)
    tags = llm_result["tags"]
    keywords = llm_result["keywords"]
    category = llm_result["category"]

    if not tags and not keywords and not category:
        return {"contents": [], "count": 0}

    if not tags and not keywords:
        return ContentTool(db, category, [])

    # 태그 경로 + 키워드 경로를 합치고 content_id로 중복 제거
    merged = []
    seen_ids = set()

    if tags:
        tag_result = ContentTool(db, None, tags)
        for item in tag_result["contents"]:
            if item["content_id"] not in seen_ids:
                seen_ids.add(item["content_id"])
                merged.append(item)

    if keywords:
        kw_result = KeywordTool(db, keywords)
        for item in kw_result["contents"]:
            if item["content_id"] not in seen_ids:
                seen_ids.add(item["content_id"])
                merged.append(item)

    # 3건 미만이고 태그가 있으면 연관 태그로 확장 (결과 뒤에 추가)
    if len(merged) < 3 and tags:
        related = RelatedTagTool(db, tag_name=tags[0])
        expanded_tags = tags + related["related_tags"]
        expand_result = ContentTool(db, None, expanded_tags)
        for item in expand_result["contents"]:
            if item["content_id"] not in seen_ids:
                seen_ids.add(item["content_id"])
                merged.append(item)

    return {"contents": merged, "count": len(merged)}