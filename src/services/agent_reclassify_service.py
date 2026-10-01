# from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from pipeline.LLM_reclassify import reclassify_content
from pipeline.tag_utils import find_or_create_tag

def Scope_Tool(db, allowed_categories: list[str], allowed_tags: list[str]):
    query = db.query(content_class)
    
    if allowed_categories :
        query = query.filter(content_class.category.in_(allowed_categories))
        
    if allowed_tags:
        query = query.join(contenttag_class, content_class.Content_id == contenttag_class.Content_id)\
        .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
        .filter(tag_class.Name.in_(allowed_tags))\
        .distinct()
        
    reclassify__results = query.all()
    results = []
    for sea_cont in reclassify__results:
        
        # 해당 콘텐츠의 태그 조회
        tags = []
        tag_rows = db.query(tag_class.Name)\
            .join(contenttag_class, tag_class.Tag_id == contenttag_class.Tag_id)\
            .filter(contenttag_class.Content_id == sea_cont.Content_id)\
            .all()
    
        for tag_row in tag_rows:
            tags.append(tag_row[0])
            
        results.append({
            "content_id": sea_cont.Content_id,
            "title": sea_cont.title,
            "summary": sea_cont.summary,
            "category": sea_cont.category,
            "tags": tags,  # 일단 빈 리스트
            "memo": sea_cont.memo
        })
    return {"contents": results, "count": len(results)}

def CategoryTool(db, content_id: int, new_category: str):
    db.query(content_class)\
        .filter(content_class.Content_id == content_id)\
        .update({"category": new_category})


def TagTool(db, content_id: int, new_tags: list[str]):
    db.query(contenttag_class)\
        .filter(contenttag_class.Content_id == content_id)\
        .delete()

    for tag_name in new_tags:
        tag = find_or_create_tag(db, tag_name)
        new_link = contenttag_class(Content_id=content_id, Tag_id=tag.Tag_id)
        db.add(new_link)

def ReclassifyAgent(db, allowed_categories: list[str], allowed_tags: list[str], purpose: str) -> dict:
    scope_result = Scope_Tool(db, allowed_categories, allowed_tags)
    content_in_scope = scope_result["contents"]
    
    if not content_in_scope:
        return {"results": []}
    
    tag_pool = []
    for tag_row in db.query(tag_class.Name).all():
        tag_pool.append(tag_row[0])
    
    action_plan = reclassify_content(content_in_scope, purpose, tag_pool)
    
    results = []
    for action in action_plan["actions"]:
        
        if action["change_needed"] == False:
            results.append({
                "content_id": action["content_id"],
                "status": "skipped",
                "reason": action["reason"]
            })
            continue
        
        # change_needed == True인 경우
        try:
            original = next(c for c in content_in_scope if c["content_id"] == action["content_id"])

            CategoryTool(db, action["content_id"], action["category"])
            TagTool(db, action["content_id"], action["tags"])
            db.commit()

            results.append({
                "content_id": action["content_id"],
                "status": "success",
                "reason": action["reason"],
                "diff": {
                    "category": {
                        "before": original["category"],
                        "after": action["category"]
                    },
                    "tags": {
                        "added": action["tags"]
                    }
                }
            })

        except Exception as e:
            db.rollback()
            results.append({
                "content_id": action["content_id"],
                "status": "failed",
                "reason": str(e)
            })        
    
    return {"results": results}