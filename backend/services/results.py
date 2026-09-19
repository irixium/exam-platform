from database import get_connection
from schemas.results import ExamResult, ExamQuestionResult, DetailedExamResult
from fastapi import HTTPException
from fastapi.responses import FileResponse

def get_results(username: str, admin_view: bool):
    with get_connection() as conn:
        params = []
        query = """SELECT t2.attempt_id, t1.exam_id, t1.name, t1.exam_type, 
                                t1.description, t1.duration, t1.total_marks,
                                t1.total_questions, t2.score, t2.submission_time, t2.username FROM exam_catalog t1 
                                JOIN  exam_attempts t2 
                                ON
                                t1.exam_id = t2.exam_id
                                WHERE t2.evaluation_status = 'evaluated'"""
        
        if not admin_view:
            query += "AND t2.username = ?" 
            params.append(username)
        cursor = conn.execute(query, params)
        results = cursor.fetchall()
        return [ExamResult(attempt_id=result[0], exam_id=result[1], name=result[2], exam_type=result[3],
                           description=result[4], duration=result[5], total_marks=result[6], total_questions=result[7],
                           score=result[8], submission_time=result[9], username=result[10]) for result in results]

def get_attempt_result(username: str, attempt_id: str, is_admin: bool):
    with get_connection() as conn:
        params = [attempt_id]
        query = """SELECT
                    ec.exam_id,
                    ec.name,
                    ec.exam_type,
                    ec.description,
                    ec.duration,
                    ec.total_marks,
                    ec.total_questions,
                    ea.score,
                    ea.submission_time,
                    ea.username
                FROM exam_attempts ea
                JOIN exam_catalog ec
                    ON ec.exam_id = ea.exam_id
                WHERE ea.attempt_id = ?"""
        if not is_admin:
            query += "AND ea.username = ?" 
            params.append(username)
        cursor = conn.execute(query, params)
        exam_result = cursor.fetchone()
        if not exam_result:
            raise HTTPException(
                        status_code=404,
                        detail="Attempt not found"
                    )
        exam_id = exam_result[0]
        cursor = conn.execute("""
                                SELECT
                                    a.question_number,
                                    asub.answer,
                                    a.correct_answer,
                                    a.correct_score,
                                    a.incorrect_score,
                                    a.question_type,
                                    a.option_count,

                                    CASE
                                        WHEN asub.answer IS NULL THEN 0
                                        WHEN a.correct_answer = asub.answer THEN a.correct_score
                                        ELSE a.incorrect_score
                                    END AS score,

                                    CASE
                                        WHEN asub.answer IS NOT NULL
                                            AND a.correct_answer = asub.answer
                                        THEN 1
                                        ELSE 0
                                    END AS is_correct,

                                    CASE
                                        WHEN asub.answer IS NOT NULL THEN 1
                                        ELSE 0
                                    END AS is_attempted

                                FROM answers AS a

                                LEFT JOIN answer_submissions AS asub
                                    ON asub.exam_id = a.exam_id
                                    AND asub.question_number = a.question_number
                                    AND asub.attempt_id = ?

                                WHERE a.exam_id = ?
                                ORDER BY a.question_number
                            """, [attempt_id, exam_id])
        question_results = cursor.fetchall()
        question_results = [
                            ExamQuestionResult(
                                question_number=question_result[0],
                                answer=question_result[1],
                                correct_answer=question_result[2],
                                correct_score=question_result[3],
                                incorrect_score=question_result[4],
                                question_type=question_result[5],
                                option_count=question_result[6],
                                score=question_result[7],
                                is_correct=bool(question_result[8]),
                                is_attempted=bool(question_result[9])
                            )
                            for question_result in question_results
                        ]   
        return DetailedExamResult(
                                attempt_id=attempt_id,
                                exam_id=exam_result[0],
                                name=exam_result[1],
                                exam_type=exam_result[2],
                                description=exam_result[3],
                                duration=exam_result[4],
                                total_marks=exam_result[5],
                                total_questions=exam_result[6],
                                score=exam_result[7],
                                submission_time=exam_result[8],
                                username=exam_result[9],
                                question_results=question_results,
                            )

def fetch_exam_pdf(attempt_id: str, username: str, is_admin: bool):
    from pathlib import Path
    with get_connection() as conn:
        params = [attempt_id]
        query = """SELECT ec.exam_path FROM exam_catalog ec JOIN exam_attempts ea
        on ec.exam_id = ea.exam_id WHERE ea.attempt_id = ? AND ea.submission_time is NOT NULL"""
        if not is_admin:
            query += " and ea.username = ?"
            params.append(username)
        cursor = conn.execute(query, params)
        exam_row = cursor.fetchone()
        if not exam_row:
            raise HTTPException(status_code=404, detail="Exam not found or attempt doesn't match user")
        exam_path = exam_row[0]
        if not Path(exam_path).is_file():
            raise HTTPException(status_code=404, detail="Exam file not found")
        
    return FileResponse(path=exam_path, media_type='application/pdf', 
                        headers={"Content-Disposition": "inline"})
    
