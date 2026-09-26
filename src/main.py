from fastapi import FastAPI
from database.database import engine
from api.content import router
from api.graph import router as g_router

app = FastAPI( )

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
    