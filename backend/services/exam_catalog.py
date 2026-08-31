from schemas.exam_catalog import CatalogItem, Question
from database import get_connection
from fastapi import UploadFile, File, HTTPException
import csv
from io import StringIO
import uuid

async def upload(data: CatalogItem, csv_file: UploadFile):
    if not csv_file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV file.")
        
    content = await csv_file.read()
    content = content.decode("utf-8")
    reader = csv.DictReader(StringIO(content))

    try:
        questions = [Question(**row) for row in reader]
        with get_connection() as conn:
            exam_id = str(uuid.uuid4())
            conn.execute("""
                INSERT INTO exam_catalog (exam_id, name, exam_type, description, duration, total_marks, state, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (exam_id, data.name, data.exam_type, data.description, data.duration, data.total_marks, data.state))
            
        return {"data": data,  "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing CSV, please check the file format: {str(e)}")

def get_catalog_items():
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM exam_catalog")
        rows = cursor.fetchall()
        return [CatalogItem(
            exam_id=row[0],
            name=row[1],
            description=row[2],
            duration=row[3],
            total_marks=row[4],
            created_at=row[5],
            updated_at=row[6]
        ) for row in rows]

def get_exam_questions(exam_id: str):
    with get_connection() as conn:
        cursor = conn.execute("SELECT * FROM exam_questions WHERE exam_id = ?", (exam_id,))
        rows = cursor.fetchall()
        return [{"question_id": row[0], "exam_id": row[1], "question_number": row[2], "question_subject": row[3],
                  "question_text": row[4], "options": row[5], "correct_answer": row[6]} for row in rows]


    