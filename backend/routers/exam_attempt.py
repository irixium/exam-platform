from fastapi import APIRouter, Depends
from services.exam_attempt import start_exam, get_question_list, submit_exam, fetch_exam_pdf
from services.auth import get_current_user
from schemas.exam_attempt import SubmittedAnswer
from schemas.auth import AuthenticatedUser
from typing import List

router = APIRouter()

@router.get("/start-exam/{exam_id}")
def start(exam_id: str, user_info: AuthenticatedUser = Depends(get_current_user)):
    return start_exam(exam_id, user_info.username)

@router.get("/fetch_exam/{attempt_id}")
def fetch_exam(attempt_id: str, user_info: AuthenticatedUser = Depends(get_current_user)):
    return fetch_exam_pdf(attempt_id, user_info.username)

@router.get("/question-list/{attempt_id}")
def get_questions(attempt_id: str, user_info: AuthenticatedUser = Depends(get_current_user)):
    return get_question_list(attempt_id, user_info.username)

@router.post("/submit-exam/{attempt_id}")
def submit(attempt_id: str, answers: List[SubmittedAnswer], user_info: AuthenticatedUser = Depends(get_current_user)):
    return submit_exam(attempt_id, user_info.username, answers)