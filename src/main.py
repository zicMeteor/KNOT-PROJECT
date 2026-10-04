from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.database import engine, Base
from database.models import *
from api.content import router
from api.graph import router as g_router
from api.agent import router as agent_router
from api.reclassify import router as reclass_router


Base.metadata.create_all(bind=engine)
app = FastAPI( )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello FastAPI"}

@app.get("/database")
def database():
    try:
        engine.connect()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

app.include_router(router, prefix="/api")
app.include_router(g_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(reclass_router, prefix="/api")

    