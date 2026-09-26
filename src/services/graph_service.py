from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from sqlalchemy.orm import aliased

def get_category_overview(db):
    
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

def get_tags_category(db, category):
    
    gtaph_tag = db.query(tag_class.Name, func.count())\
    .join(contenttag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
    .join(content_class, content_class.Content_id == contenttag_class.Content_id)\
    .filter(content_class.category == category)\
    .group_by(tag_class.Name).all()
    
    tag_nodes = []
    for tag_n in gtaph_tag:
        tag_nodes.append(
            {
                "id": tag_n[0],
                "name": tag_n[0],
                "val": tag_n[1]
            }
        )
    return {"tags": tag_nodes}

def get_contents_tag(db, tag_name):
    gtaph_content_graph = db.query(content_class.title, content_class.summary, 
         content_class.URL, content_class.memo, content_class.created_at)\
    .join(contenttag_class, contenttag_class.Content_id == content_class.Content_id)\
    .join(tag_class, tag_class.Tag_id == contenttag_class.Tag_id)\
    .filter(tag_class.Name == tag_name)\
    .all()
    
    content_node = []
    for content_n in gtaph_content_graph:
        content_node.append(
            {
                "title":content_n[0],
                "summary":content_n[1],
                "URL":content_n[2],
                "memo":content_n[3],
                "created_at": content_n[4]   
            }  
        )
        
    return {"contents" : content_node}
    
    