from database.models import contenttag_class, tag_class
from pipeline.LLM_reclassify import reclassify_content
from services.agent_reclassify_service import Scope_Tool, CategoryTool, TagTool


def ReclassifyPreview(db, allowed_categories: list[str], allowed_tags: list[str], purpose: str) -> dict:
    scope_result = Scope_Tool(db, allowed_categories, allowed_tags)
    content_in_scope = scope_result["contents"]
    
    if not content_in_scope:
        return {"actions": []}
    
    tag_pool = []
    for tag_row in db.query(tag_class.Name).all():
        tag_pool.append(tag_row[0])
    
    action_plan = reclassify_content(content_in_scope, purpose, tag_pool)
    
    actions = []
    for action in action_plan["actions"]:
        original = next(c for c in content_in_scope if c["content_id"] == action["content_id"])
        
        actions.append({
            "content_id": action["content_id"],
            "title": original["title"],
            "change_needed": action["change_needed"],
            "reason": action["reason"],
            "current_category": original["category"],
            "current_tags": original["tags"],
            "category": action["category"],
            "tags": action["tags"]
        })
    
    return {"actions": actions}


def ReclassifyExecute(db, actions: list) -> dict:
    results = []
    for action in actions:
        
        if action["change_needed"] == False:
            results.append({
                "content_id": action["content_id"],
                "status": "skipped",
                "reason": action["reason"]
            })
            continue
        
        try:
            CategoryTool(db, action["content_id"], action["category"])
            TagTool(db, action["content_id"], action["tags"])
            db.commit()
            
            results.append({
                "content_id": action["content_id"],
                "status": "success",
                "reason": action["reason"]
            })
            
        except Exception as e:
            db.rollback()
            results.append({
                "content_id": action["content_id"],
                "status": "failed",
                "reason": str(e)
            })
    success_count = len([r for r in results if r["status"] == "success"])
    fail_count = len([r for r in results if r["status"] == "failed"])
    
    return {
        "success_count": success_count,
        "fail_count": fail_count,
        "results": results
    }