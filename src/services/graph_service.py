from sqlalchemy import func, text
from database.models import content_class, contenttag_class, tag_class
from sqlalchemy.orm import aliased
from pipeline.tag_utils import get_tags_by_content

def get_category_overview(db):
    try:
        nodes = []
        for g_node in db.query(content_class.category, func.count()).group_by(content_class.category).all():
            nodes.append({"id": g_node[0], "name": g_node[0], "val": g_node[1]})
        
        ct1 = aliased(contenttag_class)
        ct2 = aliased(contenttag_class)
        c1 = aliased(content_class)
        c2 = aliased(content_class)
        
        g_links = db.query(c1.category, c2.category)\
            .join(ct1, ct1.Content_id == c1.Content_id)\
            .join(ct2, ct2.Tag_id == ct1.Tag_id)\
            .join(c2, c2.Content_id == ct2.Content_id)\
            .filter(ct1.Content_id != ct2.Content_id)\
            .filter(c1.category != c2.category)\
            .all()
            
        seen = set()
        links = []
        for source, target in g_links:
            key = tuple(sorted([source, target]))
            if key not in seen:
                seen.add(key)
                links.append({"source": source, "target": target})
                    
        return {"nodes": nodes, "links": links}
    except Exception as e:
        raise RuntimeError(f"그래프 데이터 조회 실패: {str(e)}")

def get_tags_category(db, category):
    try:
        gtaph_tag = db.query(tag_class.Name, func.count())\
        .join(contenttag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
        .join(content_class, content_class.Content_id == contenttag_class.Content_id)\
        .filter(content_class.category == category)\
        .group_by(tag_class.Name).all()
        
        tag_nodes = []
        for tag_n in gtaph_tag:
            tag_nodes.append({"id": tag_n[0], "name": tag_n[0], "val": tag_n[1]})

        # co-occurrence 링크 추가
        sql = text("""
            SELECT t1.Name, t2.Name, COUNT(*) as weight
            FROM contenttag ct1
            JOIN tag t1 ON t1.Tag_id = ct1.Tag_id
            JOIN contenttag ct2 ON ct2.Content_id = ct1.Content_id
            JOIN tag t2 ON t2.Tag_id = ct2.Tag_id
            JOIN content c ON c.Content_id = ct1.Content_id
            WHERE c.category = :category
            AND t1.Tag_id < t2.Tag_id
            GROUP BY t1.Name, t2.Name
        """)
        link_rows = db.execute(sql, {"category": category}).fetchall()
        
        links = []
        for row in link_rows:
            links.append({"source": row[0], "target": row[1], "weight": row[2]})

        return {"tags": tag_nodes, "links": links}
    except Exception as e:
        raise RuntimeError(f"태그 조회 실패: {str(e)}")
    
def get_contents_tag(db, tag_name):
    try:
        gtaph_content_graph = db.query(
            content_class.Content_id,
            content_class.title,
            content_class.category,
            content_class.summary, 
            content_class.URL, 
            content_class.memo, 
            content_class.created_at
        )\
        .join(contenttag_class, contenttag_class.Content_id == content_class.Content_id)\
        .join(tag_class, tag_class.Tag_id == contenttag_class.Tag_id)\
        .filter(tag_class.Name == tag_name)\
        .all()
        
        tags_map = get_tags_by_content(db, [row.Content_id for row in gtaph_content_graph])
        
        content_node = []
        for content_n in gtaph_content_graph:
            content_node.append({
                "content_id": content_n.Content_id,
                "title": content_n.title,
                "category": content_n.category,
                "summary": content_n.summary,
                "URL": content_n.URL,
                "memo": content_n.memo,
                "created_at": content_n.created_at,
                "tags": tags_map.get(content_n.Content_id, [])
            })
        return {"contents": content_node}
    except Exception as e:
        raise RuntimeError(f"콘텐츠 조회 실패: {str(e)}")