from fastapi import APIRouter, Depends
from services.exam_attempt import start_exam, submit_exam, fetch_exam_pdf, SubmittedAnswers
from services.auth import get_current_user
from typing import List

router = APIRouter()

@router.get("/start-exam/{exam_id}")
def start(exam_id: str, user_info: tuple = Depends(get_current_user)):
    username, _ = user_info
    return start_exam(exam_id, username)

@router.get("/fetch_exam/{attempt_id}")
def fetch_exam(attempt_id: str, user_info: tuple = Depends(get_current_user)):
    username, _ = user_info
    return fetch_exam_pdf(attempt_id, username)

@router.post("/submit-exam/{attempt_id}")
def submit(attempt_id: str, answers: List[SubmittedAnswers], user_info: tuple = Depends(get_current_user)):
    username, _ = user_info
    return submit_exam(attempt_id, username, answers)