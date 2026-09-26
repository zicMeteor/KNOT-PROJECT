from sqlalchemy import func
from database.models import content_class, contenttag_class
from sqlalchemy.orm import aliased

def s_graph(db):
    
    nodes = []
    for g_node in db.query(content_class.category, func.count()).group_by(content_class.category).all():
        nodes.append(
            {
                "id": g_node[0], 
                "name": g_node[0], 
                "val": g_node[1]
            }
        )
    
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
            
    