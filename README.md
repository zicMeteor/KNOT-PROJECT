# 🪢 KNOT

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Claude API](https://img.shields.io/badge/Claude_API-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://docs.anthropic.com/)

**KNOT**은 링크나 PDF를 넣으면 AI가 요약하고 분류해서, 이미 저장한 자료와 이어 주는 개인 지식 북마크 서비스입니다.
AI가 붙인 요약·카테고리·태그는 **사용자가 확인한 뒤에만 저장**되고, 저장한 자료는 태그를 매개로 **3D 지식 그래프**로 이어집니다.
쌓인 자료는 그래프, 목록 검색, 자연어 **AI 검색**으로 다시 찾을 수 있습니다.

---

## ✨ 주요 기능

* **AI 분석 후 확인 저장**: URL 또는 PDF 1개를 넣으면 본문을 추출하고, Claude가 300자 이내 요약, 카테고리 1개(6개 중), 태그 1~5개를 만듭니다. 결과를 확인한 뒤 **저장** 또는 **취소**합니다. 이미 저장한 URL은 다시 저장하지 않습니다.
* **기존 태그 재사용**: 분석할 때 지금까지 쓴 태그 목록을 함께 보내, 뜻이 같은 태그는 새로 만들지 않고 기존 태그를 쓰게 합니다. 그래서 자료끼리 태그로 이어집니다.
* **3D 지식 그래프**: 태그가 노드, 두 태그가 같은 자료에 함께 붙은 횟수가 선이 됩니다. 카테고리별로 좁혀 볼 수 있고, 태그를 누르면 그 태그의 자료 목록과 상세 내용이 열립니다.
* **AI로 찾기**: "지난번에 본 컨테이너 자료"처럼 자연어로 물으면 Claude가 질문에서 카테고리·태그·핵심어를 뽑아 자료를 찾고, 그래프에서 찾은 노드로 카메라가 이동해 강조합니다.
* **목적 기반 재분류**: "시험 공부용으로 다시 묶어 줘"처럼 목적을 적고 검토 범위(전체 또는 카테고리 하나)를 고르면, 그 범위의 최근 자료부터 15건씩 AI가 다시 검토해 카테고리·태그 변경안과 이유를 보여 줍니다. 확인하고 **적용**을 눌러야 반영되며, 남은 자료가 있으면 **다음 15건**을 이어서 검토할 수 있습니다.
* **전체 자료**: 저장한 날짜별 보기, 제목·요약·태그·출처·메모 단어 검색, 카테고리 필터를 제공합니다. 검색 결과가 없으면 같은 검색어로 AI 검색을 이어서 할 수 있습니다.
* **홈 화면**: 최근 자료 카드와 그 태그가 빛나는 그래프, 저장한 날짜 순서대로 그래프가 자라나는 타임라인을 보여 줍니다.

> 카테고리는 6개로 고정되어 있습니다: `학습`, `참고`, `연구`, `아이디어`, `도구`, `기타`

---

## 🛠 기술 스택

### Frontend
* **Core**: React 19, Vite 8
* **Routing**: React Router 7
* **Graph**: react-force-graph-3d, three.js, three-spritetext (지식 그래프), Canvas 2D (홈 화면 그래프)
* **Styling**: CSS Modules

### Backend
* **Core**: Python 3.13, FastAPI, Uvicorn
* **AI**: Anthropic Claude API (분석·검색 `claude-sonnet-4-6`, 재분류 `claude-haiku-5-5`)
* **DB & ORM**: MySQL, SQLAlchemy 2, PyMySQL
* **Extraction**: Trafilatura (웹 본문), Playwright Chromium (JS로 그리는 페이지 폴백), PyMuPDF (PDF)

---

## 🔄 동작 흐름

```text
URL / PDF 입력
   │
   ▼
본문 추출 ─ Trafilatura (실패하면 Playwright로 다시 시도) / PyMuPDF
   │        본문이 300자 미만이면 분석하지 않음
   ▼
AI 분석 ─ Claude: 요약 + 카테고리 + 태그 (기존 태그 목록을 함께 전달)
   │
   ▼
사용자 확인 ─ 저장 또는 취소
   │
   ▼
MySQL 저장 ─ 자료(content) + 태그(tag) + 자료-태그 연결(contenttag)
   │
   ▼
다시 찾기 ─ 지식 그래프 / 목록 검색 / AI로 찾기 / 재분류
```

---

## 📁 프로젝트 구조

```text
KNOT/
├── requirements.txt          # 백엔드 의존성
├── .env.example              # 백엔드 환경 변수 예시 (복사해서 .env로 사용)
├── src/                      # FastAPI 백엔드 — 반드시 src/ 안에서 실행
│   ├── main.py               # 앱 생성, CORS, 라우터 등록, 테이블 자동 생성
│   ├── api/                  # 라우터
│   │   ├── content.py        # 분석(URL·PDF), 저장, 목록, 취소 기록
│   │   ├── graph.py          # 카테고리 그래프, 태그 공출현 그래프, 태그별 자료
│   │   ├── agent.py          # AI로 찾기
│   │   └── reclassify.py     # 재분류 미리보기·적용
│   ├── services/             # 저장·그래프·검색·재분류 로직, 사용 기록
│   ├── pipeline/             # URL/PDF 본문 추출, LLM 프롬프트와 응답 검증
│   └── database/             # DB 연결(database.py), 테이블 정의(models.py)
└── frontend/                 # React 프론트엔드
    ├── .env.example          # 프론트엔드 환경 변수 예시 (복사해서 .env로 사용)
    ├── vite.config.js
    └── src/
        ├── api/              # 백엔드 API 호출 함수 (content, graph, aiSearch, reclassify)
        ├── pages/            # 홈, 자료 추가, 지식 그래프, 전체 자료
        ├── components/       # 화면별 구성 요소
        │   ├── home/         # 홈 화면 (카드 더미, 그래프, 타임라인)
        │   ├── add/          # 자료 추가 화면 (분석 결과)
        │   ├── graph/        # 지식 그래프 화면 (그래프, 태그 패널, AI 검색, 재분류 창)
        │   ├── library/      # 전체 자료 화면
        │   ├── ui/           # 공용 버튼, 알림
        │   └── Layout.jsx    # 상단 메뉴와 화면 틀
        ├── hooks/            # 자료·그래프·AI 검색·재분류 상태 관리
        ├── lib/              # 홈 그래프 엔진(threadGraph), 태그 그래프 계산
        ├── constants/        # 카테고리 목록과 색
        └── styles/           # 공통 색·글꼴 토큰
```

---

## 🚀 시작하기 (Getting Started)

### 실행 환경

* Windows 10/11 (아래 명령은 PowerShell 기준)
* Python 3.13
* Node.js 20.19 이상 또는 22.12 이상
* MySQL 서버
* Anthropic API 키

### 1. 데이터베이스 준비

```sql
CREATE DATABASE KNOT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

테이블은 백엔드를 처음 실행할 때 자동으로 만들어집니다. 로그인 기능이 없어 모든 자료가 `users_id = 1`로 저장되므로, 백엔드를 한 번 실행해 테이블이 생긴 뒤 사용자 1명을 넣습니다.

```sql
USE KNOT;
INSERT INTO users (users_id) VALUES (1);
```

### 2. 백엔드 (Backend) 설정

**① 가상환경과 의존성 설치** (프로젝트 루트 `KNOT/`에서)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

**② 환경 변수 파일 만들기**

```powershell
Copy-Item .env.example .env
```

만들어진 `.env`를 편집기로 열어 값을 채웁니다. (`.env`는 Git에 올라가지 않습니다)

```text
ANTHROPIC_API_KEY=발급받은_API_키
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=MySQL_비밀번호
DB_NAME=KNOT
```

**③ 서버 실행** (반드시 `src/` 폴더에서)

```powershell
cd src
uvicorn main:app --reload
```

* 모든 import가 `src/` 기준이므로 **반드시 `src/` 폴더에서** 실행합니다.
* 확인: `http://127.0.0.1:8000/database` 가 `{"status":"ok"}`, API 문서(Swagger UI)는 `http://127.0.0.1:8000/docs`
* `Activate.ps1` 실행이 막히면 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` 후 다시 실행합니다.

### 3. 프론트엔드 (Frontend) 설정

**① 패키지 설치** (새 PowerShell 창에서)

```powershell
cd frontend
npm install
```

**② 환경 변수 파일 만들기**

```powershell
Copy-Item .env.example .env
```

`frontend/.env`에는 백엔드 주소가 들어 있습니다. 백엔드를 기본 주소로 실행했다면 고칠 필요가 없습니다.

```text
VITE_API_URL=http://127.0.0.1:8000
```

**③ 개발 서버 실행**

```powershell
npm run dev
```

브라우저에서 **`http://localhost:5173`** 을 엽니다.

* 백엔드가 `http://localhost:5173`만 허용합니다(CORS). `127.0.0.1:5173`이나 다른 포트로 열면 API 호출이 막힙니다.
* 3D 그래프는 WebGL을 사용하므로 브라우저 하드웨어 가속이 켜져 있어야 합니다.

---

## 🔗 주요 API 엔드포인트

| HTTP Method | Endpoint | 설명 |
|---|---|---|
| **GET** | `/database` | DB 연결 확인 |
| **POST** | `/api/content/analyze` | URL 분석 (저장하지 않음) |
| **POST** | `/api/content/analyze-pdf` | PDF 분석 (저장하지 않음) |
| **POST** | `/api/content` | 분석 결과 저장 |
| **POST** | `/api/content/discard` | 분석 결과를 저장하지 않고 취소한 사실 기록 |
| **GET** | `/api/content` | 전체 자료 목록 |
| **GET** | `/api/graph` | 카테고리 그래프 |
| **GET** | `/api/graph/category/{category}` | 카테고리별 태그 공출현 그래프 |
| **GET** | `/api/graph/tag/{tag_name}/contents` | 태그별 자료 목록 |
| **POST** | `/api/agent/search` | AI로 찾기 |
| **POST** | `/api/agent/reclassify/preview` | 재분류 미리보기 (DB를 바꾸지 않음). `categories`로 범위, `before_id`로 다음 묶음 지정 |
| **POST** | `/api/agent/reclassify` | 재분류 적용 |

자세한 요청·응답 형식은 백엔드 서버 실행 후 `/docs` (Swagger UI)에서 확인할 수 있습니다.

---

## 🗄️ 데이터베이스

| 테이블 | 내용 |
|---|---|
| `users` | 사용자 (현재는 1명 고정) |
| `content` | 자료: 제목, 요약, 카테고리, URL, 출처, 메모, 저장 시각 |
| `tag` | 태그 이름 (대소문자를 무시한 비교용 이름 포함) |
| `contenttag` | 자료와 태그 연결 |
| `agenthistory` | AI 작업 기록용 (테이블만 있고 현재 코드에서는 쓰지 않음) |
| `eventlog` | 분석·저장·취소·AI 검색 사용 기록 (성공 여부, 걸린 시간) |

---

## ⚠️ 알려진 한계

* 로그인 없음 (단일 사용자)
* PDF는 텍스트가 들어 있는 PDF만 지원합니다. 스캔본 OCR은 없고, 한 번에 1개만 넣을 수 있으며, 제목은 파일명으로 저장됩니다.
* 추출된 본문이 300자 미만이면 분석하지 않습니다.
* 로그인이 필요하거나 유료 구독인 페이지는 본문 추출에 실패할 수 있습니다.
* 재분류는 한 번에 15건씩 검토합니다. 자료가 많으면 [다음 15건]으로 여러 번 이어서 검토해야 하고, 화면에서는 범위를 카테고리 하나로만 좁힐 수 있습니다(태그로는 좁힐 수 없음).
