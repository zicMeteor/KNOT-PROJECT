from typing import Optional
# from sqlalchemy import func
from database.models import content_class, contenttag_class, tag_class
from pipeline.LLM_search import analyze_search_query
from sqlalchemy import text

def ContentTool(db, category: Optional[str], tags: list[str]):
    query = db.query(content_class)
    
    if category :
        query = query.filter(content_class.category == category)
    
    if tags:
        query = query.join(contenttag_class, content_class.Content_id == contenttag_class.Content_id)\
                     .join(tag_class, contenttag_class.Tag_id == tag_class.Tag_id)\
                     .filter(tag_class.Name.in_(tags))
        
    search_results = query.all()
    contents = []
    for sea_cont in search_results:
        
        contents.append({
            "title": sea_cont.title,
            "category" : sea_cont.category,
            "summary": sea_cont.summary,
            "URL" : sea_cont.URL,
            "created_at" : sea_cont.created_at
        })
    return {"contents": contents, "count": len(contents)}
        
def RelatedTagTool(db, tag_name: str):
    sql = text("""
        SELECT t2.Name, COUNT(*) as co_count
        FROM contenttag ct1
        JOIN tag t1 ON t1.Tag_id = ct1.Tag_id
        JOIN contenttag ct2 ON ct2.Content_id = ct1.Content_id
        JOIN tag t2 ON t2.Tag_id = ct2.Tag_id
        WHERE t1.Name = :tag_name
        AND t2.Name != :tag_name
        GROUP BY t2.Name
        ORDER BY co_count DESC
        LIMIT 3
    """)
    
    results = db.execute(sql, {"tag_name": tag_name}).fetchall()
    related_tags = [row[0] for row in results]
    return {"related_tags": related_tags}

def AgentLoop(db, query: str):    
    loop_agent = []
    for loop_result in db.query(tag_class.Name).all():
           loop_agent.append(loop_result[0])
    llm_result = analyze_search_query(query, tag_pool=loop_agent)
    cont_result = ContentTool(db, category=llm_result["category"],tags=llm_result["tags"])
    
    if not llm_result["tags"]:
        if llm_result["category"] == None:
            return {"contents": [], "count": 0}
        else:
            return cont_result
    else:
        
        if cont_result["count"] >= 3:
            return cont_result
        
        if cont_result["count"] < 3:
            if llm_result["tags"]:
                tagtool_result = RelatedTagTool(db, tag_name=llm_result["tags"][0])
                expanded_tags = llm_result["tags"] + tagtool_result["related_tags"]
                expand_result = ContentTool(db,category=llm_result["category"],tags=expanded_tags)
                return expand_result
        
    return cont_result