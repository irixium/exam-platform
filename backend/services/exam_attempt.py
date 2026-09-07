import time
from fastapi import HTTPException
from fastapi.responses import FileResponse
from typing import List
from pydantic import BaseModel
from database import get_connection
import uuid
from schemas.exam_attempt import SubmittedAnswer, ExamQuestionMetadata

def start_exam(exam_id: str, username: str):
    current_time = int(time.time())
    
    try:
        attempt_id = str(uuid.uuid4())
        with get_connection() as conn:
            duration = conn.execute("SELECT duration FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
            if not duration:
                raise HTTPException(status_code=404, detail="Exam not found")
            """write lock, anything under this needs to acquire this before executing, 
            so no other start request can see an unsubmitted attempt if a previous request is already working on it"""
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
            duration = duration[0] * 60 
            expiry_time = current_time + duration
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
        exam_id = get_valid_exam_id(attempt_id, username, conn)
        
        exam_row = conn.execute("SELECT exam_path FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
        if not exam_row:
            raise HTTPException(status_code=404, detail="Exam not found")
        exam_path = exam_row[0]
        
    return FileResponse(path=exam_path, media_type='application/pdf', 
                        headers={"Content-Disposition": "inline"})
def submit_exam(attempt_id: str, username: str, answers: List[SubmittedAnswer]):
    with get_connection() as conn:
        exam_id = get_valid_exam_id(attempt_id, username, conn, grace_seconds=20)
        try:
            submission_time = int(time.time())
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

def get_question_list(attempt_id: str, username: str):
    with get_connection() as conn:
        exam_id = get_valid_exam_id(attempt_id, username, conn)
        cursor = conn.execute("""SELECT 
        exam_id, question_number, correct_score, incorrect_score, question_type, option_count 
        FROM answers WHERE exam_id = ?""", (exam_id,))
        answer_rows = cursor.fetchall()
        return [ExamQuestionMetadata(
            exam_id=row[0],
            question_number=row[1],
            correct_score=row[2],
            incorrect_score=row[3],
            question_type=row[4],
            option_count=row[5]
        ) for row in answer_rows]

def get_valid_exam_id(attempt_id: str, username: str, conn: any, grace_seconds: int = 0):
    row = conn.execute("""SELECT exam_id, expiry_time FROM exam_attempts 
                WHERE attempt_id = ? AND username = ? AND SUBMISSION_TIME IS NULL""", (attempt_id, username)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam attempt not found or already submitted")
    exam_id, expiry_time = row
    current_time = int(time.time())
    if current_time > expiry_time + grace_seconds:
        raise HTTPException(status_code=400, detail="Exam attempt has expired")
    assert_exam_exists(exam_id, conn)
    return exam_id

def assert_exam_exists(exam_id: str, conn: any):
    row = conn.execute("SELECT 1 FROM exam_catalog WHERE exam_id = ?", (exam_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
