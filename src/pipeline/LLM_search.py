import anthropic
import json
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

SEARCH_PROMPT = """너는 사용자의 검색 목적을 분석해서 
적절한 카테고리와 태그를 선택하는 AI다.

규칙:
1. category는 아래 목록 중 하나만 선택. 없으면 null
   ["학습", "참고", "연구", "아이디어", "도구", "기타"]
2. tags는 아래 태그 목록에서만 선택. 최대 3개
   {tag_pool}
3. 반드시 JSON만 반환. 다른 텍스트 없음

반환 형식:
{{
  "category": "학습" or null,
  "tags": ["태그1", "태그2"]
}}"""

def analyze_search_query(query, tag_pool: list[str]) -> dict:
    client = anthropic.Anthropic()
    
    tag_pool_str = ", ".join(tag_pool) if tag_pool else "없음"
    system = SEARCH_PROMPT.format(tag_pool=tag_pool_str)
    raw_search = ""
    
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=100,
            system=system,
            messages=[{"role": "user", "content": query}],
        )
        raw_search = response.content[0].text
        raw_search = raw_search.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw_search)
    
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}\n원문: {raw_search}")
    
    except Exception as e:
        raise RuntimeError(f"API 호출실패: {e}")
    
    return result