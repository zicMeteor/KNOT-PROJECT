import anthropic
import json
from dotenv import load_dotenv

load_dotenv()

CATEGORIES = ["학습", "참고", "연구", "아이디어", "도구", "기타"]

RECLASSIFY_PROMPT = """당신은 콘텐츠 재분류를 수행하는 AI입니다.
사용자가 제시한 목적과 검토 대상 콘텐츠를 분석하여,
각 콘텐츠가 사용자의 목적에 더 적합한 카테고리와 태그를 가지도록 재분류 여부를 판단하세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명이나 텍스트는 절대 포함하지 마세요.

## 1. 재분류 대상
검토 대상에 포함된 콘텐츠만 처리할 수 있습니다.
각 콘텐츠의 content_id는 반드시 검토 대상에 포함된 content_id 중 하나를 그대로 사용하세요.
검토 대상에 없는 콘텐츠를 새로 추가하거나 임의의 content_id를 생성하지 마세요.

## 2. 재분류 판단
각 콘텐츠마다 반드시 하나의 action을 생성하세요.
change_needed 판단 기준:
- true: 현재 카테고리 또는 태그가 사용자의 목적에 비해 적절하지 않은 경우
- false: 현재 분류가 사용자의 목적에 충분히 적합하여 변경할 필요가 없는 경우
변경이 필요 없는 콘텐츠도 반드시 action에 포함하고 change_needed를 false로 설정하세요.

## 3. reason (필수)
change_needed가 true든 false든 반드시 reason을 작성하세요.
- true인 경우: 왜 현재 분류가 부적절한지, 어떤 기준으로 변경하는지 설명
- false인 경우: 왜 현재 분류가 적절한지 설명

## 4. 카테고리
사용 가능한 카테고리는 다음 6개뿐입니다.
- 학습: 개념이나 기술을 단계적으로 배우기 위한 콘텐츠
- 참고: 필요할 때 정보를 찾아보기 위한 공식 문서, API 문서, 사양 등
- 연구: 논문, 학술적 연구 결과, 실험 및 연구 목적의 콘텐츠
- 아이디어: 아직 구체화되지 않은 영감, 구상, 기획 등의 콘텐츠
- 도구: 도구, 프레임워크, 개발 도구 등의 소개 및 사용 방법
- 기타: 위 카테고리 중 명확하게 해당하지 않는 콘텐츠
change_needed가 true인 경우 반드시 위 6개 중 하나를 지정하세요.
change_needed가 false인 경우 category는 null로 설정하세요.

## 5. 태그
기존 태그 목록: {tag_pool}
- 기존 태그를 우선적으로 사용하세요.
- 콘텐츠 형식이나 출처를 나타내는 태그는 사용하지 마세요. (뉴스, 블로그, 문서 등)
- 최소 1개, 최대 5개
- 중복 태그 금지
- change_needed가 true인 경우에만 tags를 지정하세요.
- change_needed가 false인 경우 tags는 null로 설정하세요.

## 6. 출력 형식
{{
  "actions": [
    {{
      "content_id": 1,
      "change_needed": true,
      "reason": "현재 '학습' 카테고리보다 '참고'가 더 적합함",
      "category": "참고",
      "tags": ["FastAPI", "REST API"]
    }},
    {{
      "content_id": 2,
      "change_needed": false,
      "reason": "현재 분류가 사용자 목적에 적합함",
      "category": null,
      "tags": null
    }}
  ]
}}

## 7. 최종 검증
응답 전 스스로 확인하세요.
- 모든 검토 대상 콘텐츠가 actions에 포함되었는가?
- 검토 대상에 없는 content_id가 포함되지 않았는가?
- 모든 reason이 작성되었는가?
- change_needed가 true인 경우 category가 6개 중 하나인가?
- change_needed가 true인 경우 tags가 1~5개인가?
- change_needed가 false인 경우 category와 tags가 null인가?
- 불필요한 재분류를 하지 않았는가?"""

#allowed_content_ids: set[int] -> content_id 집합
def validate_action_plan(result: dict, allowed_content_ids: set[int]) -> bool:

    if "actions" not in result:
        return False

    if not isinstance(result["actions"], list):
        return False

    if len(result["actions"]) == 0:
        return False

    # 중복 및 누락 검증
    returned_ids = [action["content_id"] for action in result["actions"] 
                    if isinstance(action, dict) and "content_id" in action]
    
    if len(returned_ids) != len(set(returned_ids)):  # 중복 확인
        return False
    
    if set(returned_ids) != allowed_content_ids:  # 누락 확인
        return False

    for action in result["actions"]:

        required_fields = {"content_id", "change_needed", "reason", "category", "tags"}
        if not required_fields.issubset(action):
            return False

        if action["content_id"] not in allowed_content_ids:
            return False

        if not isinstance(action["change_needed"], bool):
            return False

        if not isinstance(action["reason"], str) or not action["reason"].strip():
            return False

        if action["change_needed"]:
            if action["category"] not in CATEGORIES:
                return False

            if not isinstance(action["tags"], list):
                return False

            if not 1 <= len(action["tags"]) <= 5:
                return False

            if not all(isinstance(tag, str) and tag.strip() for tag in action["tags"]):
                return False

            if len(action["tags"]) != len(set(action["tags"])):
                return False

        else:
            if action["category"] is not None:
                return False

            if action["tags"] is not None:
                return False

    return True
            

# purpose : 사용자 목적어 문장
def reclassify_content(contents_in_scope: list[dict], purpose: str, tag_pool: list[str]) -> dict:
    client = anthropic.Anthropic()
    
    tag_pool_str = ", ".join(tag_pool) if tag_pool else "없음"
    system = RECLASSIFY_PROMPT.format(tag_pool=tag_pool_str)
    raw = ""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=system,
            messages=[{
                "role": "user", 
                "content": f"목적: {purpose}\n\n검토 대상:\n{json.dumps(contents_in_scope, ensure_ascii=False)}"
            }],
        )
        raw = response.content[0].text
        raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(raw)

    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}\n원문: {raw}")
    
    except Exception as e:
        raise RuntimeError(f"API 호출실패: {e}")
    
    allowed_content_ids = set()
    for c in contents_in_scope:
        allowed_content_ids.add(c["content_id"])
    
    if not validate_action_plan(result, allowed_content_ids):
        raise ValueError(f"LLM 결과 형식 오류: {result}")

    return result