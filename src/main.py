from fastapi import FastAPI
from src.database.database import engine

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