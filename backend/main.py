from fastapi import FastAPI, Request, HTTPException, Depends
from starlette.middleware.sessions import SessionMiddleware
from routers import auth, exam_catalog
from services.auth import get_current_user
from app_secrets import session_secret_key
from database import init_db
from database import get_connection
init_db()

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(auth.router)
app.include_router(exam_catalog.router)
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root(user_info: tuple = Depends(get_current_user)):
    username, is_admin = user_info
    return {"message": f"Welcome {username} to the Exam Catalog API", "is_admin": is_admin, "username": username}
