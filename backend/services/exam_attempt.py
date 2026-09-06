import time
from fastapi import HTTPException
from fastapi.response import FileResponse
from typing import List
from pydantic import BaseModel
from services.exam_catalog import Answer
from database import get_connection

class SubmittedAnswers(BaseModel):
    question_number: int
    answer: str

def get_exam_by_id(exam_id: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
        if row:
            return {
                "exam_id": row[0],
                "name": row[1],
                "exam_type": row[2],
                "description": row[3],
                "duration": row[4],
                "total_marks": row[5],
            }



def start_exam(exam_id: str, username: str):
    current_time = int(time.time())
    exam_item = get_exam_by_id(exam_id)
    if not exam_item:
        raise HTTPException(status_code=404, detail="Exam not found")
    duration = exam_item['duration'] * 60 
    expiry_time = current_time + duration
    try:
        with get_connection() as conn:
            conn.execute("INSERT INTO exam_attempts (exam_id, username, start_time, expiry_time) VALUES (?, ?, ?, ?)",
                        (exam_id, username, current_time, expiry_time))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting exam: {str(e)}")
    return FileResponse(path=exam_item['exam_path'], filename=f"{exam_item['name']}.pdf", media_type='application/pdf')




def submit_exam(exam_id: str, username: str, answers: List[SubmittedAnswers]):
    with get_connection() as conn:
        row = conn.execute("SELECT * from exam_attempts WHERE exam_id = ? AND username = ?", (exam_id, username)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Exam attempt not found")
        expiry_time = row[4]
        submission_time = int(time.time())
        if submission_time > expiry_time + 25:  
            raise HTTPException(status_code=400, detail="Exam submission time exceeded")
        try:
            conn.executemany("""INSERT INTO answer_submissions (exam_id, username, question_number, answer) 
                                VALUES (?, ?, ?, ?)""", [(exam_id, username, answer.question_number, answer.answer)
                                                            for answer in answers])
            conn.execute("UPDATE exam_attempts SET submission_time = ? WHERE exam_id = ? AND username = ?",
                        (submission_time, exam_id, username))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error submitting exam: {str(e)}")
    