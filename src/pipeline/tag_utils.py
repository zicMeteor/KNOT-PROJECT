from database.models import tag_class, contenttag_class

def find_or_create_tag(db, tag_name: str) -> tag_class:
    normalized = tag_name.strip().lower()
    
    # Name_lower 기준으로 조회
    existing = db.query(tag_class).filter(
        tag_class.Name_lower == normalized
    ).first()
    
    if existing:
        return existing
    
    # 없으면 새로 생성
    new_tag = tag_class(Name=tag_name.strip(), Name_lower=normalized)
    db.add(new_tag)
    db.flush()
    return new_tag

def get_tags_by_content(db, content_ids: list[int]) -> dict[int, list[str]]:
    if not content_ids:
        return{}
    
    rows = db.query(contenttag_class.Content_id, tag_class.Name)\
        .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
        .filter(contenttag_class.Content_id.in_(content_ids))\
        .all()
        
    result = {cid: [] for cid in content_ids}
    for content_id, name in rows:
        result[content_id].append(name)
        
    return result