from database.models import content_class, contenttag_class, tag_class
from pipeline.LLM_reclassify import reclassify_content, validate_action
from services.agent_reclassify_service import Scope_Tool, CategoryTool, TagTool


def ReclassifyPreview(db, allowed_categories: list[str], allowed_tags: list[str], purpose: str, before_id: int | None = None) -> dict:
    scope_result = Scope_Tool(db, allowed_categories, allowed_tags, before_id)
    content_in_scope = scope_result["contents"]
    # 범위 전체 수, 이번에 검토한 수, 이번 묶음 뒤에 남은 수, 다음 묶음을 부를 때 넘길 값
    page = {
        "total": scope_result["total"],
        "reviewed": scope_result["count"],
        "remaining": scope_result["remaining"],
        "next_before_id": scope_result["next_before_id"],
    }

    if not content_in_scope:
        return {"actions": [], **page}

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

    return {"actions": actions, **page}


def ReclassifyExecute(db, actions: list) -> dict:
    if not actions:
        raise ValueError("실행할 항목이 없습니다.")

    results = []
    for action in actions:
        error = validate_action(action)
        if error:
            results.append({
                "content_id": action.get("content_id") if isinstance(action, dict) else None,
                "status": "failed",
                "reason": error
            })
            continue

        content_id = action["content_id"]

        # bool은 파이썬에서 int의 하위 타입이라 따로 막는다
        if isinstance(content_id, bool) or not isinstance(content_id, int):
            results.append({
                "content_id": content_id,
                "status": "failed",
                "reason": "content_id 형식 오류"
            })
            continue

        exists = db.query(content_class.Content_id)\
            .filter(content_class.Content_id == content_id)\
            .first()
        if not exists:
            results.append({
                "content_id": content_id,
                "status": "failed",
                "reason": "존재하지 않는 자료"
            })
            continue

        if not action["change_needed"]:
            results.append({
                "content_id": content_id,
                "status": "skipped",
                "reason": action["reason"]
            })
            continue

        # 대소문자 무시 중복 제거 (먼저 나온 것을 남김)
        tags = []
        seen = set()
        for tag in action["tags"]:
            name = tag.strip()
            key = name.lower()
            if key not in seen:
                seen.add(key)
                tags.append(name)

        try:
            CategoryTool(db, content_id, action["category"])
            TagTool(db, content_id, tags)
            db.commit()

            results.append({
                "content_id": content_id,
                "status": "success",
                "reason": action["reason"]
            })

        except Exception as e:
            db.rollback()
            results.append({
                "content_id": content_id,
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