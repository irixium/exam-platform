from fastapi import APIRouter, Depends
from schemas.auth import AuthenticatedUser
from schemas.results import ExamResult, DetailedExamResult
from services.auth import get_current_user
from services.results import get_results
router = APIRouter()

@router.get("/results", response_model=list[ExamResult])
def results(user_info: AuthenticatedUser = Depends(get_current_user)) -> list[ExamResult]:
    username = user_info.username
    return get_results(username)