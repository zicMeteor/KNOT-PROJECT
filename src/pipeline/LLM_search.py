import anthropic
import json
from dotenv import load_dotenv
from pipeline.LLM_prompt import CATEGORIES
from typing import Optional

load_dotenv()

SEARCH_PROMPT = """너는 사용자의 검색 질문을 분석해서
카테고리, 태그, 핵심어를 뽑는 AI다.

규칙:
1. category는 아래 목록 중 하나만 선택.
   ["학습", "참고", "연구", "아이디어", "도구", "기타"]
   질문에서 카테고리를 알 수 없으면 null. null은 "필터 없음"이라는 뜻이다.
   기타는 불확실할 때 쓰는 값이 아니다.
2. tags는 아래 태그 목록에서만 선택. 최대 3개.
   질문과 관련된 태그가 없으면 []. 비슷한 다른 태그로 채우지 마라.
   {tag_pool}
3. keywords는 질문에서 뽑은 핵심어 1~3개.
   태그 목록에 없어도 된다. 조사나 어미를 빼고 명사 형태로 쓴다.
4. 반드시 JSON만 반환. 다른 텍스트 없음.

반환 형식:
{{
  "category": "학습",
  "tags": ["태그1", "태그2"],
  "keywords": ["핵심어1", "핵심어2"]
}}"""


def analyze_search_query(query, tag_pool: list[str]) -> dict:
    client = anthropic.Anthropic()
    
    tag_pool_str = ", ".join(tag_pool) if tag_pool else "없음"
    system = SEARCH_PROMPT.format(tag_pool=tag_pool_str)
    raw_search = ""
    
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=400,
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
    
    # 검증 추가
        # 검증 추가
    if not isinstance(result, dict):
        raise ValueError(f"LLM 결과 형식 오류: {result}")
    
    if "category" not in result or "tags" not in result:
        raise ValueError(f"LLM 결과 필드 누락: {result}")
    
    if not isinstance(result["tags"], list):
        raise ValueError(f"tags 타입 오류: {result}")
    
    if not isinstance(result.get("keywords"), list):
        result["keywords"] = []
    
    # 에러 대신 잘못된 값만 걸러낸다
    if result["category"] not in CATEGORIES:
        result["category"] = None

    result["tags"] = [
        t.strip() for t in result["tags"] if isinstance(t, str) and t.strip()
    ][:3]

    result["keywords"] = [
        k.strip() for k in result["keywords"] if isinstance(k, str) and len(k.strip()) >= 2
    ][:3]

    return result