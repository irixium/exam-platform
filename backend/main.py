from fastapi import FastAPI, Request, HTTPException, Depends
from starlette.middleware.sessions import SessionMiddleware
from routers import auth
from app_secrets import session_secret_key
from database import init_db
from database import get_connection
init_db()

app = FastAPI()

async def get_current_user(request: Request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
        )

    with get_connection() as conn:
        cursor = conn.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row:
            return row[0]

    
    raise HTTPException(
        status_code=401,
        detail="Invalid session",
    )


app.add_middleware(SessionMiddleware, secret_key=session_secret_key)

app.include_router(auth.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root(user: str = Depends(get_current_user)):
    return {"message": f"Welcome {user} to the Exam Catalog API"}