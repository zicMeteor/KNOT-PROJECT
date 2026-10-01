# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트 맥락을 제공합니다.

## 프로젝트 개요

KNOT은 사용자가 저장한 웹 콘텐츠(URL)를 LLM(Claude)으로 분석해 **요약 · 카테고리 · 태그**를 붙여 MySQL에 저장하고, 이를 그래프 형태로 탐색·검색·재분류할 수 있게 하는 FastAPI 백엔드입니다.

## 실행

- Python 3.13, 가상환경은 `.venv/` (Windows에서 생성된 venv → `.venv\Scripts\activate`)
- Playwright 폴백을 쓰려면 `playwright install chromium` 필요
- **모든 import가 `src/` 기준 절대경로**(`from database.database import ...`)이므로 `src/`에서 실행해야 함:

```bash
cd src
uvicorn main:app --reload
```

- 개별 파이프라인 모듈은 `if __name__ == "__main__":` 블록으로 수동 테스트 (`cd src && python -m pipeline.URL_parser`)
- 자동화된 테스트 스위트는 없음. `test/`(gitignore됨)에 노트북과 `integ_test.py`(실제 URL·API 호출) 수동 스크립트만 있음

## 환경 변수 (`.env`, gitignore됨)

`ANTHROPIC_API_KEY`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## 아키텍처

계층 구조: `api/`(라우터) → `services/`(비즈니스 로직 · DB 조작) → `pipeline/`(외부 I/O: 파싱, LLM 호출) / `database/`(모델 · 세션)

```
src/
├── main.py                 # FastAPI 앱, 라우터를 /api prefix로 등록, 시작 시 create_all
├── api/                    # 라우터: ValueError→400, RuntimeError→500 으로 변환
│   ├── content.py          # POST /api/content (URL 저장), GET /api/content (전체 목록)
│   ├── graph.py            # GET /api/graph, /graph/category/{category}, /graph/tag/{tag_name}/contents
│   ├── agent.py            # POST /api/agent/search
│   └── reclassify.py       # POST /api/agent/reclassify
├── services/
│   ├── content_service.py         # URL 추출 → LLM 분석 → content/tag/contenttag 저장
│   ├── graph_service.py           # 카테고리 노드·링크(태그 공유 기반), 카테고리별 태그, 태그별 콘텐츠
│   ├── agent_search_service.py    # 자연어 검색: LLM이 category/tags 선택 → 결과 <3개면 공출현 태그로 확장
│   └── agent_reclassify_service.py# 범위 조회 → LLM이 action plan 생성 → 콘텐츠별 커밋/롤백
├── pipeline/
│   ├── URL_parser.py       # trafilatura로 본문 추출, 실패 시 Playwright(headless chromium) 폴백
│   ├── PDF_parser.py       # pymupdf 텍스트 추출 + _clean_text (API에는 아직 미연결)
│   ├── LLM_prompt.py       # 콘텐츠 분석 프롬프트 + validate_result
│   ├── LLM_search.py       # 검색 쿼리 → category/tags
│   └── LLM_reclassify.py   # 재분류 프롬프트 + validate_action_plan
└── database/
    ├── database.py         # engine(mysql+pymysql), SessionLocal, get_db 의존성
    └── models.py           # users, content, tag, contenttag(N:M), agenthistory
```

### LLM 호출 패턴 (pipeline/LLM_*.py 공통)

1. `anthropic.Anthropic().messages.create(model="claude-sonnet-4-6", ...)`
2. 시스템 프롬프트에 **기존 태그 목록(`tag_pool`)을 주입**해 태그 재사용 유도 (`{tag_pool}` 포맷 → 프롬프트 내 JSON 중괄호는 `{{ }}`로 이스케이프)
3. 응답에서 ```` ```json ```` 펜스 제거 후 `json.loads`
4. 전용 validate 함수로 스키마 검증, 실패 시 `ValueError` / API 오류는 `RuntimeError`

새 LLM 기능을 추가할 때 이 패턴과 예외 타입 규약을 따를 것 (라우터가 이 두 예외 타입으로 HTTP 코드를 결정함).

### 데이터 모델 규약

- 모델 클래스명은 `<table>_class` (예: `content_class`), 컬럼명은 기존 DB에 맞춘 혼합 케이스(`Content_id`, `Tag_id`, `Name`, `Name_lower`)
- 카테고리는 고정 6개: `학습, 참고, 연구, 아이디어, 도구, 기타`. **`models.py`의 Enum, `LLM_prompt.py`·`LLM_reclassify.py`의 `CATEGORIES`, 각 프롬프트 본문**에 중복 정의되어 있으므로 변경 시 모두 수정
- `summary`는 DB에서 `String(300)` → 검증에서도 300자 제한
- 스키마는 `Base.metadata.create_all`로만 생성됨 (마이그레이션 도구 없음). 기존 테이블에 컬럼을 추가하면 **DB에 직접 ALTER 필요**

## 알아둘 점 / 현재 한계

- 인증 없음: `content_service`에서 `users_id = 1` 하드코딩
- 태그 중복 판정 불일치: `content_service`는 `Name_lower`로 비교·생성하지만, `agent_reclassify_service.TagTool`은 `Name`으로 비교하고 `Name_lower` 없이 태그를 생성함
- `agenthistory` 테이블은 모델만 있고 아직 사용되지 않음
- `src/main/` 빈 디렉터리 존재
- 코드 주석·에러 메시지·프롬프트는 한국어로 작성됨 — 동일하게 유지
