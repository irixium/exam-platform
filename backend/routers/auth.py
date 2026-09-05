from fastapi import APIRouter, Request
from schemas.auth import SignupRequest, SigninRequest
from services.auth import validateUser, addUser
router = APIRouter()

@router.post("/signin")
def signIn(data: SigninRequest, request: Request):
    result = validateUser(data)
    if not result:
        return {"error": "Invalid credentials"}
    request.session["user_id"] = result["user_id"]
    return {"message": "User signed in successfully"}

@router.post("/signup")
def signUp(data: SignupRequest):
    return addUser(data)

@router.post("/signout")
def signOut(request: Request):
    request.session.clear()
    return {"message": "User signed out successfully"}