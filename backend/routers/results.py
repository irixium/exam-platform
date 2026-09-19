from fastapi import APIRouter, Depends
from typing import Literal
from schemas.auth import AuthenticatedUser
from schemas.results import ExamResult, DetailedExamResult
from services.auth import get_current_user
from services.results import get_results, get_attempt_result
from fastapi import HTTPException
router = APIRouter()


#admins can see their personal results using normal request, and can see all results using view=admin
@router.get("/results", response_model=list[ExamResult])
def results(user_info: AuthenticatedUser = Depends(get_current_user), view: Literal["admin"] | None = None) -> list[ExamResult]:
    username, is_admin = user_info.username, user_info.is_admin
    if view == "admin" and not is_admin:
        raise HTTPException(
                                status_code=400,
                                detail="You are not an admin"
                            )
    return get_results(username, admin_view = view is not None)

#by default, all admins can view any attempt_id without needing a view= param
@router.get("/result/{attempt_id}", response_model=DetailedExamResult)
def result_attempt(attempt_id: str, 
                   user_info: AuthenticatedUser = Depends(get_current_user)) -> DetailedExamResult:
    username, is_admin = user_info.username, user_info.is_admin
    return get_attempt_result(username, attempt_id, is_admin)