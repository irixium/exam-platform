from fastapi import FastAPI, Request, HTTPException
from starlette.middleware.sessions import SessionMiddleware
from routers import auth
from app_secrets import session_secret_key
from database import init_db
from database import get_connection
init_db()

app = FastAPI()

app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(auth.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root(request: Request):
    user_id = request.session.get("user_id")
    if user_id:
        with get_connection() as conn:
            cursor = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                return {"message": f"Welcome {row[0]} to the Exam Catalog API"}
    return HTTPException(status_code=401, detail="Unauthorized. Please log in to access this resource.")