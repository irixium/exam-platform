from fastapi import APIRouter, Depends
from services.exam_attempt import start_exam, submit_exam, SubmittedAnswers
from services.auth import get_current_user
from typing import List

router = APIRouter()

@router.get("/start-exam/{exam_id}")
def start(exam_id: str, user_info: tuple = Depends(get_current_user)):
    username, _ = user_info
    return start_exam(exam_id, username)

@router.post("/submit-exam/{exam_id}")
def submit(exam_id: str, answers: List[SubmittedAnswers], user_info: tuple = Depends(get_current_user)):
    username, _ = user_info
    return submit_exam(exam_id, username, answers)