import json
import uuid

from database.models import agenthistory_class, content_class
from pipeline.LLM_reclassify import reclassify_content, validate_action
from pipeline.tag_utils import get_tags_by_content, user_tag_pool
from services import ai_quota
from services.agent_reclassify_service import Scope_Tool, CategoryTool, TagTool


def _same_classification(category, tags, current_category, current_tags) -> bool:
    """태그는 소문자 이름(Name_lower) 하나로만 저장되므로 대소문자나 순서만 다른 안은 실제로 바뀌는 것이 없다"""
    def names(items):
        return {t.strip().lower() for t in items or []}
    return category == current_category and names(tags) == names(current_tags)


def ReclassifyPreview(db, user, allowed_categories: list[str], allowed_tags: list[str], purpose: str, before_id: int | None = None) -> dict:
    scope_result = Scope_Tool(db, user.id, allowed_categories, allowed_tags, before_id)
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

    tag_pool = user_tag_pool(db, user.id)

    ai_quota.consume(db, user, "reclassify")
    action_plan = reclassify_content(content_in_scope, purpose, tag_pool)

    actions = []
    for action in action_plan["actions"]:
        original = next(c for c in content_in_scope if c["content_id"] == action["content_id"])

        change_needed, category, tags, reason = action["change_needed"], action["category"], action["tags"], action["reason"]
        # AI가 '변경'이라 했어도 지금과 같으면 변경 없음으로 내린다
        if change_needed and _same_classification(category, tags, original["category"], original["tags"]):
            change_needed, category, tags = False, None, None
            reason = reason.strip() + " (지금 분류와 같아 변경 제외)"

        actions.append({
            "content_id": action["content_id"],
            "title": original["title"],
            "change_needed": change_needed,
            "reason": reason,
            "current_category": original["category"],
            "current_tags": original["tags"],
            "category": category,
            "tags": tags
        })

    return {"actions": actions, **page}


def ReclassifyExecute(db, user, actions: list, purpose: str | None = None, trigger: str = "manual") -> dict:
    """적용한 자료마다 이력(바꾸기 전·후)을 남긴다. 같은 run_id가 한 번에 적용한 묶음"""
    if not actions:
        raise ValueError("실행할 항목이 없습니다.")
    run_id = uuid.uuid4().hex
    trigger = trigger if trigger in ("manual", "auto") else "manual"

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

        # 내 자료인지 확인한다. 남의 자료 번호를 넣어도 바꿀 수 없다
        content = db.query(content_class)\
            .filter(content_class.Content_id == content_id, content_class.users_id == user.id)\
            .first()
        if not content:
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

        before = {"category": content.category, "tags": get_tags_by_content(db, [content_id])[content_id]}
        # 미리보기 뒤에 자료가 이미 같은 분류가 됐을 수도 있다. 바뀌는 것이 없으면 이력도 남기지 않는다
        if _same_classification(action["category"], tags, before["category"], before["tags"]):
            results.append({
                "content_id": content_id,
                "status": "skipped",
                "reason": "지금 분류와 같아 바꾸지 않았습니다"
            })
            continue

        try:
            CategoryTool(db, content_id, action["category"])
            TagTool(db, content_id, tags)
            db.add(agenthistory_class(
                Content_id=content_id,
                users_id=user.id,
                run_id=run_id,
                kind="reclassify",
                trigger_type=trigger,
                goal=purpose,
                result=action["reason"],
                before_json=json.dumps(before, ensure_ascii=False),
                after_json=json.dumps({"category": action["category"], "tags": tags}, ensure_ascii=False),
            ))
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
        "run_id": run_id,
        "success_count": success_count,
        "fail_count": fail_count,
        "results": results
    }
