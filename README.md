# KNOT

URL이나 PDF를 넣으면 LLM이 **요약 · 카테고리 · 태그**를 붙여 저장하고, 저장한 자료를 **3D 지식 그래프**로 탐색·검색·재분류하는 개인 지식 관리 서비스입니다.
대구대학교 공학제 출품작 (1인 개발).

## 주요 기능

| 화면 | 기능 |
| --- | --- |
| 자료 추가 (`/add`) | URL 또는 PDF 1개 입력 → 본문 추출 → LLM이 요약·카테고리·태그 생성 → 결과 확인 후 저장/취소. 최근 추가한 자료 5건 표시 |
| 지식 그래프 (`/graph`) | 카테고리 노드 → 클릭하면 해당 카테고리의 태그 공출현 그래프로 전환. 태그 클릭 시 오른쪽 패널에 자료 목록·상세 |
| AI로 찾기 (그래프 하단 검색창) | 자연어 질문 → LLM이 기존 태그 중에서 태그·키워드를 골라 자료를 찾음 → 찾은 노드로 카메라 이동·강조. 찾는 중 `Esc`/`×`로 취소 |
| 재분류 (그래프 화면 버튼) | 목적 문장 입력 → 최근 15건을 LLM이 검토 → 변경 전/후와 이유 미리보기 → 선택 적용 (자료별로 커밋/롤백) |
| 전체 자료 (`/library`) | 전체 목록, 단어 검색(제목·URL·요약·메모·태그), 카테고리 필터 |

- 카테고리는 6개 고정: `학습`, `참고`, `연구`, `아이디어`, `도구`, `기타`
- 태그는 자료당 1~5개. 기존 태그 목록을 LLM에 함께 보내 같은 태그를 재사용하도록 유도

## 기술 스택

- **Frontend**: React 19, Vite 8, React Router 7, react-force-graph-3d, three-spritetext, CSS Modules
- **Backend**: FastAPI, SQLAlchemy 2, PyMySQL, Uvicorn
- **AI**: Anthropic Claude — 분석·검색 `claude-sonnet-4-6`, 재분류 `claude-haiku-5-5`
- **추출**: Trafilatura (웹), Playwright Chromium (JS 렌더링 페이지 폴백), PyMuPDF (PDF)
- **DB**: MySQL

## 폴더 구조

```
KNOT/
├── requirements.txt        # 백엔드 의존성
├── .env                    # 백엔드 환경 변수 (git 제외, 직접 만들어야 함)
├── src/                    # FastAPI 백엔드 — 반드시 src/ 안에서 실행
│   ├── main.py             # 앱, CORS, 라우터 등록, 시작 시 테이블 생성
│   ├── api/                # 라우터 (content, graph, agent, reclassify)
│   ├── services/           # 저장·그래프·검색·재분류 로직
│   ├── pipeline/           # URL/PDF 추출, LLM 프롬프트·검증
│   └── database/           # DB 연결, 모델 5개 (users, content, tag, contenttag, agenthistory)
└── frontend/               # Vite + React
    ├── .env                # VITE_API_URL (git 제외, 직접 만들어야 함)
    └── src/                # pages, components, hooks, api, styles
```

## 실행 환경

- Windows 10/11 (개발·시연 환경, 아래 명령은 PowerShell 기준)
- Python 3.13
- Node.js 20.19 이상 또는 22.12 이상 (Vite 8 요구 사항)
- MySQL 서버
- Anthropic API 키

## 1. 데이터베이스 준비

MySQL에 `KNOT` 데이터베이스를 만듭니다 (MySQL Workbench 또는 mysql 클라이언트).

```sql
CREATE DATABASE KNOT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

다음 중 하나를 고릅니다.

**A. 백업 복원 (시연 데이터 포함)** — 백업 SQL 파일이 있을 때. Workbench의 *Server → Data Import*로 가져오거나, 백업 파일이 있는 폴더에서:

```powershell
cmd /c "mysql -u root -p KNOT < knot_clean_1009.sql"
```

**B. 빈 DB로 시작** — 테이블은 백엔드를 처음 실행할 때 자동으로 만들어집니다 (`Base.metadata.create_all`).
로그인 기능이 없어 모든 자료가 `users_id = 1`로 저장되므로, 백엔드를 한 번 실행해 테이블이 생긴 뒤 사용자 1명을 넣어야 합니다.

```sql
USE KNOT;
INSERT INTO users (users_id) VALUES (1);
```

## 2. 백엔드 실행

프로젝트 루트(`KNOT/`)에 `.env` 파일을 만듭니다.

```
ANTHROPIC_API_KEY=발급받은_API_키
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=MySQL_비밀번호
DB_NAME=KNOT
```

PowerShell에서 (프로젝트 루트 기준):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
cd src
uvicorn main:app --reload
```

- 모든 import가 `src/` 기준이므로 **반드시 `src/` 폴더에서** 실행해야 합니다.
- 확인: <http://127.0.0.1:8000/database> 가 `{"status":"ok"}`, API 문서는 <http://127.0.0.1:8000/docs>
- `Activate.ps1` 실행이 막히면 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` 후 다시 실행합니다.

## 3. 프론트엔드 실행

`frontend/.env` 파일을 만듭니다.

```
VITE_API_URL=http://127.0.0.1:8000
```

새 PowerShell 창에서 (프로젝트 루트 기준):

```powershell
cd frontend
npm install
npm run dev
```

브라우저에서 **<http://localhost:5173>** 을 엽니다.

- 백엔드 CORS가 `http://localhost:5173`만 허용합니다. `127.0.0.1:5173`으로 열거나 `npm run preview`(4173 포트)로 열면 API 호출이 막힙니다.
- 3D 그래프는 WebGL을 사용합니다. 브라우저 하드웨어 가속이 켜져 있어야 합니다.

## API

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/content/analyze` | URL 분석 (저장하지 않음) |
| POST | `/api/content/analyze-pdf` | PDF 분석 (multipart, 저장하지 않음) |
| POST | `/api/content` | 분석 결과 저장 |
| GET | `/api/content` | 전체 자료 목록 |
| GET | `/api/graph` | 카테고리 그래프 |
| GET | `/api/graph/category/{category}` | 카테고리별 태그 공출현 그래프 |
| GET | `/api/graph/tag/{tag_name}/contents` | 태그별 자료 목록 |
| POST | `/api/agent/search` | AI로 찾기 |
| POST | `/api/agent/reclassify/preview` | 재분류 미리보기 (최근 15건) |
| POST | `/api/agent/reclassify` | 재분류 적용 |

## 알려진 한계

- 로그인 없음 — 단일 사용자(`users_id = 1`) 고정
- PDF는 텍스트가 들어 있는 PDF만 지원 (스캔본 OCR 없음, 한 번에 1개). 제목은 파일명으로 저장됨
- 추출된 본문이 300자 미만이면 분석하지 않음
- 로그인이 필요하거나 유료 구독 페이지는 본문 추출에 실패할 수 있음
- 재분류는 최근 15건만 검토
- `agenthistory` 테이블은 아직 사용하지 않음
- `npm run build` 시 번들 크기 경고(500kB 초과)가 나오지만 3D 라이브러리 때문이며 동작에는 영향 없음
