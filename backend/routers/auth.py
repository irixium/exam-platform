from fastapi import APIRouter, Request
from schemas.auth import SignupRequest, SigninRequest
from services.auth import validateUser, addUser
router = APIRouter()

@router.post("/signin")
def signIn(data: SigninRequest, request: Request):
    result = validateUser(data)
    if not result:
        return {"error": "Invalid credentials"}
    request.session["username"] = data.username
    return {"message": "User signed in successfully"}

@router.post("/signup")
def signUp(data: SignupRequest):
    return addUser(data)