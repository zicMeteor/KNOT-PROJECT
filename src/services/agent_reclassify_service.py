# from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from pipeline.tag_utils import find_or_create_tag

REVIEW_LIMIT = 15

def Scope_Tool(db, users_id: int, allowed_categories: list[str], allowed_tags: list[str], before_id: int | None = None):
    query = db.query(content_class).filter(content_class.users_id == users_id)

    if allowed_categories:
        query = query.filter(content_class.category.in_(allowed_categories))

    if allowed_tags:
        query = query.join(contenttag_class, content_class.Content_id == contenttag_class.Content_id)\
        .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
        .filter(tag_class.Name.in_(allowed_tags))\
        .distinct()

    total = query.count()

    # 다음 묶음: 앞 묶음의 마지막 자료보다 오래된 것부터.
    # 순번(offset) 대신 id로 이어서, 앞 묶음을 적용해 범위를 벗어난 자료가 생겨도 건너뛰는 자료가 없다
    page = query
    if before_id is not None:
        page = page.filter(content_class.Content_id < before_id)

    reclassify__results = (
        page.order_by(content_class.Content_id.desc())
        .limit(REVIEW_LIMIT)
        .all()
    )

    remaining = 0
    if reclassify__results:
        last_id = reclassify__results[-1].Content_id
        remaining = query.filter(content_class.Content_id < last_id).count()
    next_before_id = reclassify__results[-1].Content_id if remaining > 0 else None

    results = []
    for sea_cont in reclassify__results:

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
            "tags": tags,
            "memo": sea_cont.memo
        })
    return {
        "contents": results,
        "count": len(results),
        "total": total,
        "remaining": remaining,
        "next_before_id": next_before_id,
    }

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