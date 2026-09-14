from database import get_connection
from schemas.results import ExamResult

def get_results(username: str):
    with get_connection() as conn:
        cursor = conn.execute("""SELECT t2.attempt_id, t1.exam_id, t1.name, t1.exam_type, 
                                t1.description, t1.duration, t1.total_marks,
                                t1.total_questions, t2.score, t2.submission_time FROM exam_catalog t1 
                                JOIN  exam_attempts t2 
                                ON
                                t1.exam_id = t2.exam_id
                                WHERE t2.evaluation_status = 'evaluated' AND t2.username = ?""", [username])
        results = cursor.fetchall()
        return [ExamResult(attempt_id=result[0], exam_id=result[1], name=result[2], exam_type=result[3],
                           description=result[4], duration=result[5], total_marks=result[6], total_questions=result[7],
                           score=result[8], submission_time=result[9]) for result in results]