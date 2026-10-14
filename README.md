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
* **분류 다시 검토** (목적 기반 재분류): "시험 공부용으로 다시 분류해줘"처럼 목적을 적고 검토 범위(전체 또는 카테고리 하나)를 고르면, 그 범위의 최근 자료부터 15건씩 AI가 다시 검토해 카테고리·태그 변경안과 이유를 보여 줍니다. 안마다 체크를 풀 수 있고, 고른 안만 **적용**을 눌러야 반영되며, 남은 자료가 있으면 **다음 15건**을 이어서 검토할 수 있습니다.
* **전체 자료**: 저장한 날짜별 보기, 제목·요약·태그·출처·메모 단어 검색, 카테고리 필터를 제공합니다. 검색 결과가 없으면 같은 검색어로 AI 검색을 이어서 할 수 있습니다. 자료를 열어 **삭제**할 수 있습니다(두 번 확인한 뒤 삭제, 되돌릴 수 없음).
* **홈 화면**: 최근 자료 카드와 그 태그가 빛나는 그래프, 저장한 날짜 순서대로 그래프가 자라나는 타임라인을 보여 줍니다.
* **계정과 로그인** (v2, `AUTH_ENABLED=1`일 때): 관리자가 만든 계정으로 로그인합니다(공개 가입 없음). 자료·그래프·검색·태그 목록이 계정마다 따로이고, 계정마다 AI 사용 상한(하루 또는 주 단위)이 있습니다.
* **AI 결과 평가** (v2): 분석 결과, AI 검색 결과, 분류 다시 검토 제안마다 👍/👎를 누를 수 있습니다. 분류 다시 검토 안을 적용하면 바꾸기 전·후가 이력으로 남습니다.
* **실패 처리** (v2, `FAILURE_ASSIST=1`일 때): 본문이 짧은 페이지(80~299자)도 "짧은 본문"으로 분석하고, AI 호출이 실패하면 한 번 다시 시도합니다. 그래도 실패하면 이유(로그인 필요, 접속 실패, 본문 없음, AI 한도 등)를 보여 주고 두 가지 길을 줍니다.
  * **본문 붙여넣기**: 페이지에서 복사한 글을 AI가 분석합니다 (링크만 해당).
  * **메모 쓰고 저장**: AI 없이 제목·카테고리·메모(필수)·태그(선택)로 저장합니다.
* **저장 전 고치기** (v2): AI가 제안한 카테고리와 태그를 저장 전에 고칠 수 있습니다(태그 최대 5개, 이미 쓰는 태그 자동 완성). 고친 내용은 사용 기록에 남습니다.

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
   │        본문이 300자 미만이면 분석하지 않음 (FAILURE_ASSIST=1이면 80자 이상은 "짧은 본문"으로 분석)
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
├── start.bat                 # 테스터용 실행 (DB 준비 → 서버 시작, "start.bat build"는 화면 빌드부터)
├── LICENSE                   # AGPL-3.0
├── src/                      # FastAPI 백엔드 — 반드시 src/ 안에서 실행
│   ├── main.py               # 앱 생성, CORS, 라우터 등록, 테이블 자동 생성, 빌드한 화면 내보내기
│   ├── settings.py           # .env의 v2 설정 (비우면 v1과 같음)
│   ├── api/                  # 라우터
│   │   ├── auth.py           # 로그인·로그아웃·내 정보
│   │   ├── content.py        # 분석(URL·PDF·붙여넣기), 저장, 목록, 취소 기록
│   │   ├── graph.py          # 카테고리 그래프, 태그 공출현 그래프, 태그별 자료
│   │   ├── agent.py          # AI로 찾기
│   │   ├── reclassify.py     # 재분류 미리보기·적용
│   │   └── feedback.py       # 👍/👎, 화면에서 보내는 사용 기록
│   ├── scripts/              # migrate.py (DB에 빠진 표·칸 추가), accounts.py (계정 관리)
│   ├── services/             # 저장·그래프·검색·재분류 로직, 로그인, AI 사용량, 사용 기록
│   ├── pipeline/             # URL/PDF 본문 추출, LLM 프롬프트와 응답 검증
│   └── database/             # DB 연결(database.py), 테이블 정의(models.py)
└── frontend/                 # React 프론트엔드
    ├── .env.example          # 프론트엔드 환경 변수 예시 (복사해서 .env로 사용)
    ├── vite.config.js
    └── src/
        ├── api/              # 백엔드 API 호출 함수 (auth, content, graph, aiSearch, reclassify, feedback)
        ├── pages/            # 로그인, 홈, 자료 추가, 지식 그래프, 전체 자료
        ├── components/       # 화면별 구성 요소
        │   ├── home/         # 홈 화면 (카드 더미, 그래프, 타임라인)
        │   ├── add/          # 자료 추가 화면 (분석 결과)
        │   ├── graph/        # 지식 그래프 화면 (그래프, 태그 패널, AI 검색, 재분류 창)
        │   ├── library/      # 전체 자료 화면
        │   ├── ui/           # 공용 버튼, 알림, 👍/👎
        │   ├── AuthGate.jsx  # 로그인 확인 (안 되어 있으면 로그인 화면)
        │   └── Layout.jsx    # 상단 메뉴, 사용량·로그아웃, 화면 틀
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
python -m scripts.migrate
uvicorn main:app --reload
```

* `scripts.migrate`는 v1에서 쓰던 DB에 v2의 표와 칸을 더합니다. 이미 있으면 그냥 지나가므로 여러 번 실행해도 됩니다.

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

`VITE_API_URL`은 **비워 둡니다**. 화면은 같은 주소의 `/api`를 부르고, 개발 서버(`vite.config.js`)가 이를 `http://127.0.0.1:8000`으로 넘깁니다. 로그인을 켰을 때 주소를 따로 적으면 로그인 쿠키가 전달되지 않습니다.

```text
VITE_API_URL=
```

**③ 개발 서버 실행**

```powershell
npm run dev
```

브라우저에서 **`http://localhost:5173`** 을 엽니다.

* 3D 그래프는 WebGL을 사용하므로 브라우저 하드웨어 가속이 켜져 있어야 합니다.
* `VITE_API_URL`에 백엔드 주소를 직접 적으면 백엔드가 `http://localhost:5173`만 허용하므로(CORS) 다른 주소로 열 때 API 호출이 막힙니다.

### 결과보고서 집계

테스트 기간(테스터)과 공학제 시연(부스)의 사용 기록을 따로 집계합니다. DB는 읽기만 합니다.

```powershell
cd src
python -m scripts.report                              # 테스터(10.16~10.25)와 부스(10.26~10.30)
python -m scripts.report --group tester --from 2026-10-16 --to 2026-10-20
python -m scripts.report --assist-from 2026-10-18     # 실패 처리를 켠 때를 직접 지정
```

* 사용량, 분석 성공률과 실패 이유, 분석 시간, AI 제안을 고친 비율, 실패 처리 전후, 찾는 길별 열람 수, 재분류 적용률, 👍/👎, 지식 그래프 성장을 뽑습니다.
* 실패 처리를 켠 때는 서버가 켜질 때 남기는 기록(`server_start`)에서 찾습니다.
* 테스터는 아이디 대신 "테스터 A, B, C"로 씁니다(`--names`를 주면 아이디로).
* 결과는 저장소 밖 `reports/<시각>/`에 `report.md`와 지표별 CSV로 남습니다.
* 표본이 작아 비율 옆에 바탕 건수를 함께 씁니다. 예: `71% (5/7)`.

### 4. 테스터에게 열기 (v2)

로그인을 켜고, 빌드한 화면과 API를 서버 하나(`http://127.0.0.1:8000`)로 엽니다.

**① `.env`에 설정 추가**

```text
AUTH_ENABLED=1
SERVE_FRONTEND=1
FAILURE_ASSIST=1      # 실패 처리를 켤 때
COOKIE_SECURE=1       # HTTPS 주소(Tailscale Funnel)로 열 때
SURVEY_URL=설문_주소   # 상단에 설문 링크를 걸 때
```

**② 계정 만들기** (`src/` 폴더에서, 가상환경을 켠 상태로)

```powershell
python -m scripts.migrate
python -m scripts.accounts claim 1 demo --role admin   # 기존 1번 사용자(지금까지의 자료)에 아이디를 붙임
python -m scripts.accounts create tester1 --role tester
python -m scripts.accounts list
```

* 비밀번호는 무작위로 만들어 **한 번만** 보여 줍니다. 잊으면 `reset 아이디`로 다시 만듭니다(그 계정의 로그인은 모두 끊김).
* 역할별 기본값: `admin`·`showcase` 상한 없음(로그인 30일 유지), `tester` 주 150회(7일), `booth` 하루 100회(그날 밤까지). `--limit`, `--period day|week`로 바꿀 수 있습니다.
* `disable 아이디` / `enable 아이디`로 막거나 다시 허용합니다. `clone 원본 대상 --seed`는 자료와 태그 연결을 다른 계정에 복사합니다.
* 같은 아이디로 5번 틀리면 5분 동안 로그인이 막힙니다.

**③ 서버 시작** (프로젝트 루트에서)

```powershell
.\start.bat build    # 처음 또는 화면 코드를 바꿨을 때 (화면 빌드 → DB 준비 → 서버 시작)
.\start.bat          # 그다음부터
```

**④ 밖에서 들어오게 하기 (Tailscale Funnel)**

노트북에서 켠 서버(`127.0.0.1:8000`)에 공개 HTTPS 주소를 붙입니다. 노트북이 켜져 있고 서버가 실행 중일 때만 접속됩니다.

```powershell
tailscale funnel 8000
```

* 명령과 옵션은 Tailscale 버전에 따라 다를 수 있으니 [공식 문서](https://tailscale.com/kb/1223/funnel)에서 확인하세요.
* 테스트가 끝나면 Funnel을 끕니다. 공학제 시연은 로컬(`http://127.0.0.1:8000`)에서 합니다.

---

## 🔗 주요 API 엔드포인트

| HTTP Method | Endpoint | 설명 |
|---|---|---|
| **GET** | `/database` | DB 연결 확인 |
| **POST** | `/api/auth/login` | 로그인 (쿠키 `knot_session` 발급) |
| **POST** | `/api/auth/logout` | 로그아웃 |
| **GET** | `/api/auth/me` | 내 아이디, 역할, AI 사용량 |
| **POST** | `/api/content/analyze` | URL 분석 (저장하지 않음) |
| **POST** | `/api/content/analyze-pdf` | PDF 분석 (저장하지 않음) |
| **POST** | `/api/content/analyze-text` | 붙여 넣은 본문 분석 (`FAILURE_ASSIST=1`일 때만) |
| **POST** | `/api/content` | 분석 결과 저장 |
| **POST** | `/api/content/discard` | 분석 결과를 저장하지 않고 취소한 사실 기록 |
| **GET** | `/api/content` | 전체 자료 목록 |
| **DELETE** | `/api/content/{content_id}` | 자료 삭제 (내 자료만. 태그 연결은 지우고 재분류 이력은 남김) |
| **GET** | `/api/graph` | 카테고리 그래프 |
| **GET** | `/api/graph/category/{category}` | 카테고리별 태그 공출현 그래프 |
| **GET** | `/api/graph/tag/{tag_name}/contents` | 태그별 자료 목록 |
| **POST** | `/api/agent/search` | AI로 찾기 |
| **POST** | `/api/agent/reclassify/preview` | 재분류 미리보기 (DB를 바꾸지 않음). `categories`로 범위, `before_id`로 다음 묶음 지정 |
| **POST** | `/api/agent/reclassify` | 재분류 적용 (바꾸기 전·후를 이력으로 남김) |
| **POST** | `/api/feedback` | AI 결과 👍/👎 |
| **POST** | `/api/events` | 화면에서 보내는 사용 기록 (AI 검색 결과를 연 것) |

* `AUTH_ENABLED=1`이면 로그인·`/database`를 뺀 모든 API에 로그인이 필요하고, AI 사용 상한을 넘으면 `429`와 `X-Error-Code: AI_QUOTA`를 돌려줍니다.
* 자세한 요청·응답 형식은 백엔드 서버 실행 후 `/docs` (Swagger UI)에서 확인할 수 있습니다. 로그인을 켜면 `/docs`는 닫힙니다.

---

## 🗄️ 데이터베이스

| 테이블 | 내용 |
|---|---|
| `users` | 사용자: 아이디, 비밀번호 해시(scrypt), 역할, AI 사용 상한 |
| `usersession` | 로그인 세션 (토큰 원문이 아닌 해시만 저장) |
| `content` | 자료: 제목, 요약, 카테고리, URL, 출처, 메모, 저장 시각, 분석 상태, 기본 자료 표시 |
| `tag` | 태그 이름 (대소문자를 무시한 비교용 이름 포함). 표는 함께 쓰고, AI에게 보내는 태그 목록은 계정별 |
| `contenttag` | 자료와 태그 연결 |
| `agenthistory` | 재분류 이력: 목적, 이유, 바꾸기 전·후, 한 번에 적용한 묶음(`run_id`) |
| `aiusage` | AI 호출 한 번마다 한 줄 (사용 상한 계산) |
| `feedback` | AI 결과 👍/👎 |
| `graphsnapshot` | 계정별 그래프 상태(자료·태그·선·떨어진 태그 수)를 하루 한 줄 |
| `eventlog` | 분석·저장·취소·AI 검색·로그인 사용 기록 (누가, 성공 여부, 걸린 시간, 실패 이유) |

---

## ⚠️ 알려진 한계

* 공개 가입은 없습니다. 계정은 관리자가 `scripts.accounts`로 만듭니다. 로그인을 끄면(`AUTH_ENABLED` 비움) v1처럼 1번 사용자 한 명으로 동작합니다.
* PDF는 텍스트가 들어 있는 PDF만 지원합니다. 스캔본 OCR은 없고, 한 번에 1개, 20MB까지 넣을 수 있으며, 제목은 파일명으로 저장됩니다.
* AI에게는 본문 앞 30,000자까지만 보냅니다(`MAX_TEXT_CHARS`).
* 추출된 본문이 300자 미만이면 분석하지 않습니다(`FAILURE_ASSIST=1`이면 80자 이상은 짧은 본문으로 분석).
* 메모로 저장한 자료를 나중에 AI로 다시 분석하는 기능은 없습니다. 지우고 다시 넣어야 합니다.
* PDF가 실패하면 붙여넣기 없이 메모 저장만 할 수 있습니다(파일을 서버에 남기지 않음).
* 로그인이 필요하거나 유료 구독인 페이지는 본문 추출에 실패할 수 있습니다.
* 재분류는 한 번에 15건씩 검토합니다. 자료가 많으면 [다음 15건]으로 여러 번 이어서 검토해야 하고, 화면에서는 범위를 카테고리 하나로만 좁힐 수 있습니다(태그로는 좁힐 수 없음).

---

## 📄 라이선스

* 이 프로젝트는 **[AGPL-3.0](LICENSE)** 으로 공개합니다. PDF 추출에 쓰는 PyMuPDF가 AGPL-3.0이기 때문입니다.
* AGPL-3.0은 서버를 인터넷으로 다른 사람에게 쓰게 할 때도 소스 공개를 요구합니다. 그래서 화면에 소스 링크(`SOURCE_URL`)를 겁니다.
* 공개 대상은 **소스 코드**입니다. `.env`(API 키, DB 비밀번호)는 코드가 아니라 설정이므로 공개하지 않습니다.
* 이후 PDF 추출을 MIT 계열 라이브러리(pypdf 등)로 바꾸면 MIT로 옮길 계획입니다.
* 분석·검색·재분류를 할 때 자료의 본문(또는 제목·요약·태그)이 Anthropic Claude API로 전송됩니다.
