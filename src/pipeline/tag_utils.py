from database.models import tag_class

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