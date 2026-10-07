from typing import Optional
# from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from pipeline.LLM_search import analyze_search_query
from pipeline.tag_utils import get_tags_by_content
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
        WHERE t1.Name_lower = :tag_name
        AND t2.Tag_id != t1.Tag_id
        GROUP BY t2.Name
        ORDER BY co_count DESC
        LIMIT 3
    """)
    
    results = db.execute(sql, {"tag_name": tag_name.lower()}).fetchall()
    related_tags = [row[0] for row in results]
    return {"related_tags": related_tags}

def _merge(merged, seen_ids, result, match_type):
    for item in result["contents"]:
        if item["content_id"] not in seen_ids:
            seen_ids.add(item["content_id"])
            item["match_type"] = match_type
            merged.append(item)
            
def _build_response(db, items, analysis):
    # 항목별 태그를 쿼리 1번으로 가져온다 (N+1 방지)
    ids = [item["content_id"] for item in items]
    tags_by_id = {}
    if ids:
        rows = (
            db.query(contenttag_class.Content_id, tag_class.Name)
            .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)
            .filter(contenttag_class.Content_id.in_(ids))
            .all()
        )
        for content_id, name in rows:
            tags_by_id.setdefault(content_id, []).append(name)

    for item in items:
        item["tags"] = tags_by_id.get(item["content_id"], [])

    return {"analysis": analysis, "contents": items, "count": len(items)}

def AgentLoop(db, query: str):

    tag_pool = []
    for tag_row in db.query(tag_class.Name).all():
        tag_pool.append(tag_row[0])

    llm_result = analyze_search_query(query, tag_pool=tag_pool)
    tags = llm_result["tags"]
    keywords = llm_result["keywords"]
    category = llm_result["category"]
    analysis = {
        "category": category,
        "tags": tags,
        "keywords": keywords,
        "category_applied": False,
    }

    if not tags and not keywords and not category:
        return _build_response(db, [], analysis)

    if not tags and not keywords:
        analysis["category_applied"] = True
        merged = []
        _merge(merged, set(), ContentTool(db, category, []), "category")
        return _build_response(db, merged, analysis)

    # content_id로 중복 제거
    merged = []
    seen_ids = set()

    if tags:
        _merge(merged, seen_ids, ContentTool(db, None, tags), "tag")
    if keywords:
        _merge(merged, seen_ids, KeywordTool(db, keywords), "keyword")

    if len(merged) < 3 and tags:
        related = RelatedTagTool(db, tag_name=tags[0])
        expanded_tags = tags + related["related_tags"]
        _merge(merged, seen_ids, ContentTool(db, None, expanded_tags), "expanded")

    return _build_response(db, merged, analysis)