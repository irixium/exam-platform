from fastapi import FastAPI, Request, HTTPException, Depends
from starlette.middleware.sessions import SessionMiddleware
from routers import auth, exam_catalog, exam_attempt, results
from schemas.auth import AuthenticatedUser
from services.auth import get_current_user
from app_secrets import session_secret_key
from database import init_db

init_db()

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(auth.router)
app.include_router(exam_catalog.router)
app.include_router(exam_attempt.router)
app.include_router(results.router)
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root(user_info: AuthenticatedUser = Depends(get_current_user)):
    return {"message": f"Welcome {user_info.username} to the Exam Catalog API", "is_admin": user_info.is_admin, "username": user_info.username}
