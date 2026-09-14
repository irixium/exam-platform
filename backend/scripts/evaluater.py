from database import get_connection
import time

#auto_mark_submmited_after = 60 * 5 # 5 mins -> avoid any weird race conditions; 
                                   # backend will anyways prevent submission post expiry + grace
with get_connection() as conn:
    # current_time = int(time.time)()
    # conn.execute("""
    # UPDATE exam_attempts
    # SET
    # submission_time = unixepoch()
    # WHERE 
    # expiry_time + ? < unixepoch()
    # """)
    cursor = conn.execute("""
    UPDATE exam_attempts
    SET
        score = (
            SELECT SUM(
                CASE
                    WHEN t2.answer = t3.correct_answer
                        THEN t3.correct_score
                    ELSE t3.incorrect_score
                END
            )
            FROM answer_submissions t2
            JOIN answers t3
                ON t2.exam_id = t3.exam_id
                AND t2.question_number = t3.question_number
            WHERE t2.attempt_id = exam_attempts.attempt_id
        ),
        evaluation_status = 'evaluated',
        evaluation_time = unixepoch()
    WHERE evaluation_status = 'pending'
    AND submission_time IS NOT NULL;""")
    print(f"Current time: {int(time.time())}. Evaluated {cursor.rowcount} attempts.")
