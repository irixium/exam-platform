from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware
from routers import login
from secrets import session_secret_key
app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(login.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}