import anthropic
import json
from dotenv import load_dotenv

load_dotenv()

CATEGORIES = ["학습", "참고", "연구", "아이디어", "도구", "기타"]

SYSTEM_PROMPT = """당신은 웹 콘텐츠를 분석하고 분류하는 AI입니다.
주어진 텍스트를 분석하여 반드시 아래 JSON 형식으로만 답하세요.
다른 설명이나 텍스트는 절대 포함하지 마세요.

category는 반드시 아래 목록 중 하나만 선택하세요.
목록 외의 값은 절대 사용하지 마세요.

학습: 개념을 단계적으로 설명하는 교육 목적의 자료. 강의, 튜토리얼, 입문서.
참고: 필요한 정보를 조회하기 위한 자료. 공식 문서, API 문서, 기술 명세, 표준 문서.
연구: 논문, 학술 연구, 실험 결과 등 학술적 목적의 자료.
아이디어: 아직 구체적인 실행 계획이 없는 영감, 기획, 아이디어 자료.
도구: 특정 라이브러리, 프레임워크, 개발 도구의 소개 및 사용법 자료.
기타: 위 카테고리에 명확하게 해당하지 않는 자료.

판단 기준:
- 학습 vs 참고: 개념을 처음부터 설명하는 교육 형식이면 학습, 특정 정보를 조회하는 레퍼런스 형식이면 참고
- 도구 vs 학습: 특정 도구·프레임워크의 공식 소개 페이지나 메인 문서는 도구, 해당 도구를 처음 배우는 튜토리얼이면 학습
- 도구 vs 참고: 특정 도구 자체의 사용법이면 도구, 도구와 무관한 일반 기술 문서면 참고
- 기타는 다른 카테고리에 명확하게 해당하지 않을 때 선택.

tags는 콘텐츠의 핵심 기술, 개념, 주제, 분야를 나타내는 태그를 선택하세요.
아래 기존 태그 목록에서, 콘텐츠의 핵심 주제와 의미가 정확히 일치하는 태그만 그대로 사용하세요.
일치하는 태그가 없으면 기존 태그로 억지로 채우지 말고 새 태그를 만드세요.
콘텐츠에 언급되지 않은 기술이나 언어는 태그로 선택하지 마세요.
콘텐츠와 직접 관련된 태그를 1~5개 선택하세요. 개수를 채우려고 태그를 만들지 마세요.
콘텐츠 형식이나 출처를 나타내는 단어는 기존 목록에 있어도 선택하지 말고, 새로 만들지도 마세요.
(뉴스, 블로그, 문서, 강의, 튜토리얼 등은 태그로 부적절)
의미 없는 일반적인 태그는 추가하지 마세요.

기술명과 개념은 공식 표기를 사용하세요. 
(예: React.js가 아니라 React, Fast API가 아니라 FastAPI)

기존 태그 목록: {tag_pool}

summary는 콘텐츠의 핵심 내용을 한국어로 작성하세요.
콘텐츠의 주제와 핵심 정보를 중심으로 작성하세요.
원문에 없는 내용을 추측하거나 추가하지 마세요.
3문장 이내로 작성하세요.

{{
  "summary": "3문장 이내, 공백 포함 250자 이내로 작성하세요.",
  "category": "카테고리 하나",
  "tags": ["태그1", "태그2", "태그3"]
}}"""


def validate_result(result: dict) -> bool:
    
    if not isinstance(result, dict):
        return False
    
    REQUIRED_KEYS = {"summary", "category", "tags"}
    
    if set(result.keys()) != REQUIRED_KEYS:
        return False
    
    if result["category"] not in CATEGORIES:
        return False
    
    if not isinstance(result["tags"], list):
        return False
    
    if not 1 <= len(result["tags"]) <= 5:  # 1~5로 복원
        return False
    
    if not all(isinstance(tag, str) and tag.strip() for tag in result["tags"]):  # 태그 타입 검사 추가
        return False
    
    if len(result["tags"]) != len(set(result["tags"])):
        return False
    
    if not isinstance(result["summary"], str) or not result["summary"].strip():
        return False
    
    if len(result["summary"]) > 300:
        return False
    
    return True


def analyze_content(text: str, tag_pool: list[str]) -> dict:
    client = anthropic.Anthropic()
    
    tag_pool_str = ", ".join(tag_pool) if tag_pool else "없음"
    system = SYSTEM_PROMPT.format(tag_pool=tag_pool_str)
    raw = ""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": text}],
        )
        raw = response.content[0].text
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        # 문자열을 Python dict로 변환
        result = json.loads(raw)

    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}\n원문: {raw}")
    
    except Exception as e:
        raise RuntimeError(f"API 호출실패: {e}")
    
    category_fallback = False
    if isinstance(result, dict) and result.get("category") not in CATEGORIES:
        result["category"] = "기타"
        category_fallback = True
    
    if not validate_result(result):
        raise ValueError(f"LLM 결과 형식 오류: {result}")
    
    result["category_fallback"] = category_fallback
    return result
    


# 테스트
if __name__ == "__main__":
    sample_text = "여기에 분석할 텍스트를 넣으세요"
    tag_pool = []

    result = analyze_content(sample_text, tag_pool)
    print(json.dumps(result, ensure_ascii=False, indent=2))