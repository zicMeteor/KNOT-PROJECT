# KNOT

링크나 PDF를 넣으면 AI가 요약·카테고리·태그를 붙이고, 저장한 자료를 태그로 이어 3D 지식 그래프로 보여 주는 개인 지식 북마크 서비스입니다.

## 주요 기능

- **AI 분석**: URL·PDF 본문을 추출해 요약, 카테고리(학습·참고·연구·아이디어·도구·기타), 태그를 만들고, 확인한 뒤 저장
- **지식 그래프**: 태그를 노드로, 같은 자료에 함께 붙은 태그를 선으로 잇는 3D 그래프
- **AI 검색**: 자연어 질문으로 저장한 자료 찾기
- **분류 다시 검토**: 목적을 적으면 AI가 카테고리·태그 변경안을 제안하고, 고른 것만 적용
- **전체 자료**: 날짜별 목록, 단어 검색, 카테고리 필터, 삭제
- **계정**: 관리자가 만든 계정으로 로그인, 계정별 자료와 AI 사용 상한

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Frontend | React 19, Vite, React Router, react-force-graph-3d, three.js |
| Backend | Python 3.13, FastAPI, SQLAlchemy, MySQL |
| AI | Claude API (분석·검색 `claude-sonnet-5-5`, 재분류 `claude-haiku-5-5`) |
| 본문 추출 | Trafilatura, Playwright, pypdfium2 |

## 프로젝트 구조

```text
KNOT/
├── start.bat              # 화면 빌드(선택) → DB 준비 → 서버 시작
├── requirements.txt
├── .env.example
├── src/                   # FastAPI 백엔드 (src/에서 실행)
│   ├── main.py
│   ├── settings.py        # .env 설정 읽기
│   ├── api/               # 라우터: auth, content, graph, agent, reclassify, events
│   ├── services/          # 저장·그래프·검색·재분류·로그인·AI 사용량 로직
│   ├── pipeline/          # URL/PDF 본문 추출, Claude 호출과 응답 검증
│   ├── database/          # DB 연결, 테이블 정의
│   └── scripts/           # migrate(테이블 준비), accounts(계정 관리)
└── frontend/              # React 화면
    └── src/
        ├── pages/         # 로그인, 홈, 자료 추가, 지식 그래프, 전체 자료
        ├── components/    # 화면별 구성 요소
        ├── hooks/
        ├── api/           # 백엔드 호출
        ├── lib/           # 그래프 계산
        ├── constants/
        └── styles/
```

## 시작하기

준비물: Python 3.13, Node.js 20.19+, MySQL, Claude API 키

**1. DB 만들기**

```sql
CREATE DATABASE KNOT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**2. 설치**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
cd frontend; npm install; cd ..
```

**3. 환경 변수**

`.env.example`을 `.env`로 복사해 채웁니다.

```text
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=      # 게이트웨이를 쓸 때만 (예: https://gpt-gw.daegu.ac.kr)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=KNOT
AUTH_ENABLED=1           # 로그인 사용
SERVE_FRONTEND=1         # 빌드한 화면을 백엔드가 함께 내보냄
```

**4. 테이블과 관리자 계정**

```powershell
cd src
python -m scripts.migrate
python -m scripts.accounts create admin --role admin   # 비밀번호는 한 번만 표시
cd ..
```

**5. 실행**

```powershell
.\start.bat build   # 처음 또는 화면을 바꿨을 때
.\start.bat         # 그다음부터
```

`http://127.0.0.1:8000`에서 엽니다.

개발할 때는 백엔드(`cd src; uvicorn main:app --reload`)와 화면(`cd frontend; npm run dev` → `http://localhost:5173`)을 따로 띄웁니다.

## 선택 설정 (`.env`)

| 이름 | 설명 |
|---|---|
| `FAILURE_ASSIST=1` | 짧은 본문 분석, 실패 시 본문 붙여넣기·메모 저장 |
| `COOKIE_SECURE=1` | HTTPS 주소로 열 때 |
| `ALLOW_LOCAL_URLS=1` | 내부망 주소 분석 허용 (로컬 시험용) |
| `MAX_TEXT_CHARS` | AI에 보내는 본문 길이 상한 (기본 30000) |
| `MAX_PDF_MB` | PDF 크기 상한 (기본 20) |
| `AI_TIMEOUT` | AI 응답 대기 시간, 초 (기본 120) |

## 한계

- 텍스트가 있는 PDF만 지원 (스캔본 OCR 없음)
- 로그인이 필요하거나 유료인 페이지는 본문 추출에 실패할 수 있음
- 공개 가입 없음 (계정은 `scripts.accounts`로 관리)

## 라이선스

[MIT](LICENSE). `v3` 브랜치까지는 AGPL-3.0입니다.
