from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text

import settings
from database.database import engine, Base
from database.models import *
from api.auth import router as auth_router
from api.content import router
from api.feedback import router as feedback_router
from api.graph import router as g_router
from api.agent import router as agent_router
from api.reclassify import router as reclass_router
from services.event_log import log_event


Base.metadata.create_all(bind=engine)

ROOT = Path(__file__).resolve().parent.parent


def _git_commit():
    """지금 돌고 있는 코드의 커밋 (결과보고서에서 어느 버전으로 시험했는지 알려고). 모르면 None"""
    try:
        git = ROOT / ".git"
        # 작업 트리(worktree)면 .git이 실제 위치를 적은 파일이다
        if git.is_file():
            git = (ROOT / git.read_text().split("gitdir:", 1)[1].strip()).resolve()
        common = git
        if (git / "commondir").is_file():
            common = (git / (git / "commondir").read_text().strip()).resolve()
        head = (git / "HEAD").read_text().strip()
        if not head.startswith("ref:"):
            return head[:7]
        ref = head.split(" ", 1)[1]
        for base in (git, common):
            if (base / ref).is_file():
                return (base / ref).read_text().strip()[:7]
        for line in (common / "packed-refs").read_text().splitlines():
            if line.endswith(" " + ref):
                return line[:7]
    except (OSError, IndexError):
        pass
    return None


@asynccontextmanager
async def lifespan(_app):
    # 서버가 켜질 때 설정을 한 줄 남긴다 (실패 처리를 언제 켰는지 등 결과보고서의 전후 비교 기준)
    log_event(
        "server_start", True, users_id=None, commit=_git_commit(),
        auth=settings.AUTH_ENABLED, failure_assist=settings.FAILURE_ASSIST,
        serve_frontend=settings.SERVE_FRONTEND, cookie_secure=settings.COOKIE_SECURE,
        max_text_chars=settings.MAX_TEXT_CHARS, max_pdf_mb=settings.MAX_PDF_MB,
    )
    yield


# 로그인을 켠(밖에 여는) 상태에서는 API 설명서(/docs)를 숨긴다. 버튼 몇 번으로 저장·재분류를 직접 부를 수 있어서
_docs = {} if not settings.AUTH_ENABLED else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(lifespan=lifespan, **_docs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Error-Code"],
)
# 화면 파일(JS 1.8MB)과 API 응답을 압축해서 보낸다. 바깥 주소(Funnel)처럼 느린 길에서 차이가 크다
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 요청 본문 크기 상한. 본문을 받기 전에(로그인 확인보다 먼저) 거절해서 큰 파일로 디스크를 채우지 못하게 한다
PDF_PATH = "/api/content/analyze-pdf"
BODY_LIMIT = 2 * 1024 * 1024  # PDF 말고 나머지 API (붙여 넣은 본문도 AI에는 MAX_TEXT_CHARS까지만 보낸다)


@app.middleware("http")
async def limit_body(request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        pdf = request.url.path == PDF_PATH
        # PDF는 파일 상한에 업로드 양식 몫(1MB)을 더한다
        limit = (settings.MAX_PDF_MB + 1) * 1024 * 1024 if pdf else BODY_LIMIT
        size = request.headers.get("content-length")
        if pdf and size is None:
            # 크기를 알리지 않는 업로드는 끝까지 받아 봐야 알 수 있어서 받지 않는다 (브라우저는 항상 알린다)
            return JSONResponse(status_code=411, content={"detail": "파일 크기를 알 수 없습니다."})
        if size is not None and (not size.isdigit() or int(size) > limit):
            if pdf:
                # 화면이 PDF_TOO_BIG 안내를 그대로 보여 주도록 기존과 같은 400으로 답한다
                return JSONResponse(
                    status_code=400, content={"detail": f"PDF는 {settings.MAX_PDF_MB}MB까지 넣을 수 있습니다."},
                    headers={"X-Error-Code": "PDF_TOO_BIG"},
                )
            return JSONResponse(status_code=413, content={"detail": "요청이 너무 큽니다."}, headers={"X-Error-Code": "TOO_LARGE"})
    return await call_next(request)


@app.get("/database")
def database():
    # 로그인 없이 부를 수 있으므로 오류 내용은 응답에 넣지 않고 서버 로그에만 남긴다
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        print(f"DB 연결 확인 실패: {e}")
        return {"status": "error"}

app.include_router(auth_router, prefix="/api")
app.include_router(router, prefix="/api")
app.include_router(g_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(reclass_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")


# 빌드한 화면(frontend/dist)을 이 서버가 함께 내보낸다: 주소 하나로 화면과 API를 연다
DIST = ROOT / "frontend" / "dist"

if settings.SERVE_FRONTEND and (DIST / "index.html").is_file():

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="없는 API입니다.")
        target = (DIST / full_path).resolve()
        # dist 밖의 파일은 내보내지 않는다
        if full_path and target.is_file() and DIST.resolve() in target.parents:
            # assets/ 파일은 이름에 내용 해시가 붙어 있어, 바뀌면 이름도 바뀐다. 브라우저가 1년 동안 다시 받지 않게 한다
            if full_path.startswith("assets/"):
                return FileResponse(target, headers={"Cache-Control": "public, max-age=31536000, immutable"})
            return FileResponse(target)
        # 화면 안의 주소(/graph, /library 등)는 모두 index.html이 처리한다
        # index.html은 새로 빌드하면 바로 반영되도록 매번 확인하게 한다
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})

else:

    @app.get("/")
    def read_root():
        return {"message": "Hello FastAPI"}
