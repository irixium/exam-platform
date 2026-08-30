from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from routers import auth
from app_secrets import session_secret_key
from database import init_db

init_db()

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(auth.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}