from fastapi import FastAPI, Request, HTTPException, Depends, APIRouter
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from routers import auth, exam_catalog, exam_attempt, results
from schemas.auth import AuthenticatedUser
from services.auth import get_current_user
from app_secrets import session_secret_key
from database import init_db
from pathlib import Path

init_db()

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(exam_catalog.router)
api_router.include_router(exam_attempt.router)
api_router.include_router(results.router)

@api_router.get("/health")
def health_check():
    return {"status": "ok"}

@api_router.get("/")
def root(user_info: AuthenticatedUser = Depends(get_current_user)):
    return {"message": f"Welcome {user_info.username} to the Exam Catalog API", "is_admin": user_info.is_admin, "username": user_info.username}

app.include_router(api_router)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory= FRONTEND_DIR / "assets"),
        name="assets"
    )

    @app.get("/")
    def frontend():
        return FileResponse(FRONTEND_DIR / "index.html")