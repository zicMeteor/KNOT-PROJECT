from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import settings
from database.database import engine, Base
from database.models import *
from api.auth import router as auth_router
from api.content import router
from api.feedback import router as feedback_router
from api.graph import router as g_router
from api.agent import router as agent_router
from api.reclassify import router as reclass_router


Base.metadata.create_all(bind=engine)

# 로그인을 켠(밖에 여는) 상태에서는 API 설명서(/docs)를 숨긴다. 버튼 몇 번으로 저장·재분류를 직접 부를 수 있어서
_docs = {} if not settings.AUTH_ENABLED else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(**_docs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Error-Code"],
)

@app.get("/database")
def database():
    try:
        engine.connect()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

app.include_router(auth_router, prefix="/api")
app.include_router(router, prefix="/api")
app.include_router(g_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(reclass_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")


# 빌드한 화면(frontend/dist)을 이 서버가 함께 내보낸다: 주소 하나로 화면과 API를 연다
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if settings.SERVE_FRONTEND and (DIST / "index.html").is_file():

    @app.get("/{full_path:path}", include_in_schema=False)
    def frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="없는 API입니다.")
        target = (DIST / full_path).resolve()
        # dist 밖의 파일은 내보내지 않는다
        if full_path and target.is_file() and DIST.resolve() in target.parents:
            return FileResponse(target)
        # 화면 안의 주소(/graph, /library 등)는 모두 index.html이 처리한다
        return FileResponse(DIST / "index.html")

else:

    @app.get("/")
    def read_root():
        return {"message": "Hello FastAPI"}
