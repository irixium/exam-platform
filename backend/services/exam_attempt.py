import time
from fastapi import HTTPException
from fastapi.responses import FileResponse
from typing import List
from pydantic import BaseModel
from services.exam_catalog import Answer
from database import get_connection
import uuid

class SubmittedAnswers(BaseModel):
    question_number: int
    answer: str

def get_exam_by_id(exam_id: str):
    with get_connection() as conn:
        row = conn.execute("SELECT exam_id, name, exam_type, description, duration, total_marks, exam_path FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
        if row:
            return {
                "exam_id": row[0],
                "name": row[1],
                "exam_type": row[2],
                "description": row[3],
                "duration": row[4],
                "total_marks": row[5],
                "exam_path": row[6]
            }



def start_exam(exam_id: str, username: str):
    current_time = int(time.time())
    exam_item = get_exam_by_id(exam_id)
    if not exam_item:
        raise HTTPException(status_code=404, detail="Exam not found")
    duration = exam_item['duration'] * 60 
    expiry_time = current_time + duration
    try:
        attempt_id = str(uuid.uuid4())
        with get_connection() as conn:
            conn.execute("""BEGIN IMMEDIATE""")
            existing_attempt = conn.execute(
                        """
                        SELECT attempt_id
                        FROM exam_attempts
                        WHERE exam_id = ?
                        AND username = ?
                        AND submission_time IS NULL
                        AND expiry_time > ?
                        LIMIT 1
                        """,
                        (exam_id, username, current_time)
                    ).fetchone()

            if existing_attempt:
                conn.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "An existing attempt is still active. "
                        "You cannot start a new attempt until the previous one has expired."
                    )
                )
            conn.execute("""INSERT INTO exam_attempts (attempt_id, exam_id, username, start_time, expiry_time) 
                         VALUES (?, ?, ?, ?, ?)""",
                        (attempt_id, exam_id, username, current_time, expiry_time))
            conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting exam: {str(e)}")
    return {"attempt_id": attempt_id}


def fetch_exam_pdf(attempt_id: str, username: str):
    with get_connection() as conn:
        row = conn.execute("""SELECT exam_id, expiry_time FROM exam_attempts 
                           WHERE attempt_id = ? AND username = ? AND SUBMISSION_TIME IS NULL""", (attempt_id, username)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Exam attempt not found")
        exam_id, expiry_time = row
        current_time = int(time.time())
        if current_time > expiry_time:
            raise HTTPException(status_code=400, detail="Exam attempt has expired")
        
        exam_row = conn.execute("SELECT exam_path FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
        if not exam_row:
            raise HTTPException(status_code=404, detail="Exam not found")
        exam_path = exam_row[0]
        
    return FileResponse(path=exam_path, media_type='application/pdf', 
                        headers={"Content-Disposition": "inline"})
def submit_exam(attempt_id: str, username: str, answers: List[SubmittedAnswers]):
    with get_connection() as conn:
        row = conn.execute("SELECT * from exam_attempts WHERE attempt_id = ? AND username = ? AND SUBMISSION_TIME IS NULL", (attempt_id, username)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Exam attempt not found or already submitted")
        exam_id = row[1]
        expiry_time = row[4]
        submission_time = int(time.time())
        if submission_time > expiry_time + 25:  
            raise HTTPException(status_code=400, detail="Exam submission time exceeded")
        try:
            cursor = conn.execute("""UPDATE exam_attempts SET submission_time = ? WHERE
                                    attempt_id = ? AND username = ? AND SUBMISSION_TIME IS NULL""",
                                    (submission_time, attempt_id, username))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Exam attempt not found or already submitted")
            conn.executemany("""INSERT INTO answer_submissions (attempt_id, exam_id, username, question_number, answer) 
                                VALUES (?, ?, ?, ?, ?)""", [(attempt_id, exam_id, username, answer.question_number, answer.answer)
                                                            for answer in answers])
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error submitting exam: {str(e)}")
    