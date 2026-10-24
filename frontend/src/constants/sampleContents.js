// 홈에 보여 주는 예시 자료 (실제 저장 기록이 아니다)
// 자료가 0건이면 홈의 설명 구간 전체를, 자료가 적으면 "찾고, 다시 묶습니다" 구간만 채운다 (기준: lib/waysDemo.js)
// "다시 묶기" 줄은 언제나 이 자료로 보여 준다
// 모양은 api/content.js의 fetchContents와 같다. 칸: 번호, 카테고리, 저장 시각, 제목, 주소, 태그, 요약 (실제 AI 요약처럼 1~2문장)
const RAW = [
  [1, "연구", "2026-09-14T09:00:00", "Attention Is All You Need", "https://arxiv.org/abs/1706.03762", ["Transformer", "Attention", "NLP"], "순환 구조 없이 어텐션만으로 문장을 처리하는 Transformer 구조를 제안한 논문이다. 번역 성능을 높이면서 병렬 학습으로 훈련 시간을 크게 줄였다."],
  [2, "학습", "2026-09-15T10:00:00", "The Illustrated Transformer", "https://jalammar.github.io/illustrated-transformer/", ["Transformer", "Attention", "시각화"], "Transformer의 인코더·디코더와 셀프 어텐션 계산을 그림으로 한 단계씩 풀어 설명한 글이다. 논문을 읽기 전에 전체 흐름을 잡기 좋다."],
  [3, "연구", "2026-09-15T11:00:00", "BERT 논문 정리", "https://arxiv.org/abs/1810.04805", ["BERT", "Transformer", "NLP"], "문장의 앞뒤 문맥을 함께 보는 사전 학습 모델 BERT의 핵심을 정리했다. 빈칸 맞히기로 학습한 뒤 여러 NLP 과제에 맞춰 미세 조정한다."],
  [4, "학습", "2026-09-16T12:00:00", "RAG 개념 정리 노트", "https://example.com/rag-note", ["RAG", "LLM", "벡터 검색"], "질문과 관련된 문서를 먼저 찾아 LLM에 함께 넣어 답하게 하는 RAG의 구조를 정리했다. 검색, 프롬프트 구성, 답변 생성 단계로 나눠 설명한다."],
  [5, "학습", "2026-09-17T13:00:00", "LangChain으로 RAG 만들기", "https://example.com/langchain-rag", ["RAG", "LangChain", "LLM"], "LangChain으로 문서를 잘게 나누고 임베딩해 벡터 저장소에 넣은 뒤, 질문에 맞는 조각을 찾아 답하는 예제를 따라간다."],
  [6, "도구", "2026-09-18T14:00:00", "pgvector 사용법", "https://github.com/pgvector/pgvector", ["벡터 검색", "PostgreSQL"], "PostgreSQL에 벡터 칸과 유사도 검색을 더해 주는 확장 pgvector의 설치와 사용법이다. 인덱스로 가까운 벡터를 빠르게 찾는 방법을 다룬다."],
  [7, "참고", "2026-09-18T15:00:00", "프롬프트 작성 가이드", "https://example.com/prompt-guide", ["프롬프트", "LLM"], "LLM에게 역할과 맥락, 원하는 출력 형식을 분명히 주는 프롬프트 작성 요령을 모았다. 예시를 넣는 방법과 흔한 실수도 정리했다."],
  [8, "도구", "2026-09-19T16:00:00", "Claude Code 시작하기", "https://example.com/claude-code", ["Claude", "LLM", "도구"], "터미널에서 Claude에게 코드 읽기와 수정을 맡기는 Claude Code의 설치와 기본 사용법을 소개한다."],
  [9, "학습", "2026-09-20T17:00:00", "Docker 입문: 이미지와 컨테이너", "https://docs.docker.com/get-started/", ["Docker", "컨테이너"], "이미지와 컨테이너의 차이부터 Dockerfile 작성, 컨테이너 실행까지 Docker의 기본 흐름을 따라간다."],
  [10, "학습", "2026-09-21T09:00:00", "쿠버네티스 기본 개념", "https://kubernetes.io/ko/docs/concepts/", ["Kubernetes", "컨테이너", "배포"], "파드, 디플로이먼트, 서비스 같은 쿠버네티스의 핵심 객체가 무엇이고 서로 어떻게 맞물리는지 설명한다."],
  [11, "참고", "2026-09-21T10:00:00", "GitHub Actions로 CI 만들기", "https://docs.github.com/actions", ["CI/CD", "GitHub Actions", "배포"], "저장소에 워크플로 파일을 두고, 푸시할 때마다 테스트와 빌드를 자동으로 돌리는 방법을 다룬다."],
  [12, "도구", "2026-09-22T11:00:00", "Docker Compose 예제 모음", "https://example.com/compose", ["Docker", "Docker Compose"], "웹 서버와 DB처럼 여러 컨테이너를 한 파일로 정의하고 함께 띄우는 Docker Compose 예제를 모았다."],
  [13, "학습", "2026-09-23T12:00:00", "React 19 새 기능 정리", "https://react.dev/blog", ["React", "프론트엔드"], "React 19에서 달라진 점을 정리했다. 폼 처리를 돕는 Actions와 새로 추가된 훅을 예제와 함께 살펴본다."],
  [14, "참고", "2026-09-24T13:00:00", "Vite 설정 가이드", "https://vite.dev/config/", ["Vite", "프론트엔드", "빌드"], "Vite 설정 파일에서 개발 서버, 경로 별칭, 빌드 출력처럼 자주 쓰는 옵션을 설명한다."],
  [15, "아이디어", "2026-09-24T14:00:00", "3D 그래프로 북마크 보여 주기", "https://example.com/3d-idea", ["three.js", "시각화", "그래프"], "저장한 링크를 태그로 이어 3D 공간에 띄우면 어떨지 정리한 아이디어 메모다. three.js로 점과 선을 그리는 방식을 구상했다."],
  [16, "학습", "2026-09-25T15:00:00", "force-directed 그래프 원리", "https://example.com/force-graph", ["그래프", "시각화", "알고리즘"], "점끼리는 밀어내고 선은 당기는 힘을 반복 계산해 그래프의 배치를 정하는 원리를 설명한다."],
  [17, "참고", "2026-09-26T16:00:00", "웹 접근성 체크리스트", "https://example.com/a11y", ["접근성", "프론트엔드"], "색 대비, 키보드 조작, 대체 텍스트처럼 웹 페이지가 갖춰야 할 접근성 항목을 점검표로 정리했다."],
  [18, "참고", "2026-09-27T17:00:00", "CSS 스크롤 애니메이션", "https://example.com/scroll-css", ["CSS", "애니메이션", "프론트엔드"], "스크롤 위치에 맞춰 요소가 움직이는 효과를 CSS만으로 만드는 방법과 예제를 다룬다."],
  [19, "학습", "2026-09-27T09:00:00", "SQLAlchemy 2.0 튜토리얼", "https://docs.sqlalchemy.org/", ["SQLAlchemy", "Python", "MySQL"], "SQLAlchemy 2.0 방식으로 모델을 정의하고, 세션으로 자료를 조회하고 저장하는 기본 흐름을 따라간다."],
  [20, "참고", "2026-09-28T10:00:00", "MySQL 인덱스 설계", "https://example.com/mysql-index", ["MySQL", "인덱스", "DB"], "어떤 칸에 인덱스를 걸어야 조회가 빨라지는지, 여러 칸을 묶은 인덱스의 순서는 어떻게 정하는지 정리했다."],
  [21, "학습", "2026-09-29T11:00:00", "FastAPI 의존성 주입", "https://fastapi.tiangolo.com/tutorial/dependencies/", ["FastAPI", "Python"], "Depends로 DB 연결이나 로그인 확인 같은 공통 준비 작업을 여러 API에 나눠 주는 방법을 설명한다."],
  [22, "도구", "2026-09-30T12:00:00", "Trafilatura로 본문 추출", "https://trafilatura.readthedocs.io/", ["크롤링", "Python", "본문 추출"], "웹페이지 HTML에서 메뉴와 광고를 빼고 본문만 꺼내는 파이썬 라이브러리 Trafilatura의 사용법이다."],
  [23, "연구", "2026-09-30T13:00:00", "Vision Transformer 논문", "https://arxiv.org/abs/2010.11929", ["ViT", "Transformer", "컴퓨터 비전"], "이미지를 작은 조각으로 나눠 문장처럼 Transformer에 넣는 ViT를 제안한 논문이다. 큰 데이터로 학습하면 CNN에 견줄 성능을 보였다."],
  [24, "학습", "2026-10-01T14:00:00", "임베딩과 유사도 검색", "https://example.com/embedding", ["임베딩", "벡터 검색", "LLM"], "글을 숫자 벡터로 바꾸는 임베딩과, 벡터 사이 거리로 뜻이 가까운 글을 찾는 유사도 검색을 설명한다."],
  [25, "아이디어", "2026-10-02T15:00:00", "목적별로 자료 다시 묶기", "https://example.com/regroup", ["재분류", "LLM", "아이디어"], "모아 둔 자료를 시험 공부나 프로젝트처럼 목적에 맞게 다시 분류하면 어떨지 정리한 아이디어 메모다."],
  [26, "학습", "2026-10-03T16:00:00", "자료구조 시험 정리: 트리", "https://example.com/tree", ["자료구조", "시험", "알고리즘"], "이진 탐색 트리, 힙, 트리 순회 방법 등 자료구조 트리 단원의 시험 범위를 요약했다."],
  [27, "학습", "2026-10-03T17:00:00", "알고리즘 시험 정리: 그래프 탐색", "https://example.com/bfs-dfs", ["알고리즘", "그래프", "시험"], "BFS와 DFS가 그래프를 어떤 순서로 탐색하는지, 둘의 차이와 시간 복잡도를 시험 대비용으로 정리했다."],
  [28, "참고", "2026-10-04T09:00:00", "Python 비동기 프로그래밍", "https://example.com/asyncio", ["Python", "비동기"], "async와 await로 기다리는 동안 다른 작업을 처리하는 asyncio의 기본 개념과 예제를 다룬다."],
  [29, "도구", "2026-10-05T10:00:00", "Playwright로 브라우저 자동화", "https://playwright.dev/", ["Playwright", "크롤링", "테스트"], "코드로 브라우저를 열어 클릭과 입력을 자동으로 하는 Playwright의 설치와 기본 사용법이다."],
  [30, "기타", "2026-10-06T11:00:00", "개발자 회고 글 모음", "https://example.com/retro", ["회고", "커리어"], "프로젝트를 마친 개발자들이 잘된 점과 아쉬운 점을 돌아본 회고 글을 모았다."],
  [31, "연구", "2026-10-06T12:00:00", "LLM 에이전트 설계 패턴", "https://example.com/agent-patterns", ["에이전트", "LLM", "프롬프트"], "LLM이 도구를 부르고 결과를 본 뒤 다음 행동을 정하는 에이전트를 설계할 때 쓰는 대표 패턴을 정리했다."],
  [32, "학습", "2026-10-07T13:00:00", "Attention 수식 따라가기", "https://example.com/attention-math", ["Attention", "수학", "Transformer"], "쿼리·키·값 행렬로 어텐션 가중치를 계산하는 과정을 수식 한 줄씩 따라가며 설명한다."],
  [33, "참고", "2026-10-08T14:00:00", "Kubernetes 배포 전략", "https://example.com/k8s-deploy", ["Kubernetes", "배포"], "롤링 업데이트, 블루-그린, 카나리 배포가 각각 어떻게 동작하고 언제 쓰면 좋은지 비교한다."],
  [34, "학습", "2026-10-09T15:00:00", "three.js 기초", "https://threejs.org/manual/", ["three.js", "WebGL", "시각화"], "장면, 카메라, 렌더러를 만들고 도형을 그려 움직이는 three.js의 기본 구성을 익힌다."],
  [35, "아이디어", "2026-10-09T16:00:00", "지식 그래프 타임라인 연출", "https://example.com/timeline-idea", ["시각화", "애니메이션", "그래프"], "저장한 날짜 순서대로 그래프가 자라나는 모습을 보여 주면 어떨지 구상한 아이디어 메모다."],
  [36, "도구", "2026-10-10T17:00:00", "Tailscale로 로컬 서버 공개", "https://example.com/tunnel", ["배포", "네트워크"], "Tailscale로 내 컴퓨터에서 돌아가는 서버에 https 주소를 달아 밖에서도 접속하게 하는 방법이다."],
]

export const SAMPLE_CONTENTS = RAW.map(([id, category, createdAt, title, url, tags, summary]) => ({
  id: -id, // 실제 자료 번호와 겹치지 않게 음수
  title,
  category,
  summary,
  url,
  tags,
  memo: null,
  createdAt,
}))
