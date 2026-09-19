from pathlib import Path

from schemas.exam_catalog import CatalogItem, Answer, ExamUpdateRequest, ExamUploadRequest
from database import get_connection
from fastapi import UploadFile, File, HTTPException, Form
import csv
from io import StringIO
import uuid
from pypdf import PdfReader
import time

def parse_catalog_item(
    name: str = Form(...),
    exam_type: str = Form(...),
    description: str = Form(""),
    duration: int = Form(...),
    total_marks: int = Form(...),
    total_questions: int = Form(...)
) -> ExamUploadRequest:
    return ExamUploadRequest(
        name=name,
        exam_type=exam_type,
        description=description,
        duration=duration,
        total_marks=total_marks,
        total_questions=total_questions
    )


async def upload(data: ExamUploadRequest, exam_doc: UploadFile, key_csv: UploadFile, username: str):
    if exam_doc.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    try:
        await exam_doc.seek(0)
        reader = PdfReader(exam_doc.file)
        len(reader.pages)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupted PDF")
    finally:
        await exam_doc.seek(0)

    if not key_csv.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type for answer key. Please upload a CSV file.")
        
    try:
        content = await key_csv.read()
        content = content.decode("utf-8")
        rows = list(csv.DictReader(StringIO(content)))
        if len(rows) != data.total_questions:
            raise HTTPException(status_code=400, detail="Total answers provided don't match total questions")
        exam_id = str(uuid.uuid4())
        answers = [
            Answer(
                **{**row,
                   "option_count": row["option_count"] or None},
                exam_id=exam_id,
            )
            for row in rows
        ]
        for answer in answers:
            if answer.question_type == 'MCQ':
                if not answer.option_count or answer.option_count not in list(range(1,5)):
                    raise HTTPException(status_code=400, detail="Invalid input")
            else:
                if answer.option_count:
                    raise HTTPException(status_code=400, detail="Invalid input")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error parsing CSV, please check the file format: {str(e)}"
        )

    try:
        exam_path = Path("exams") / f"{exam_id}.pdf"
        exam_path.parent.mkdir(parents=True, exist_ok=True)
        with open(exam_path, "wb") as f:
            f.write(await exam_doc.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving PDF file: {str(e)}")

    try:
        with get_connection() as conn:
            conn.execute("""
                INSERT INTO exam_catalog (exam_id, name, exam_type, description, duration, total_marks, total_questions,
                exam_path, created_by, created_at, updated_by, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
            """, (exam_id, data.name, data.exam_type, data.description, data.duration, data.total_marks, data.total_questions, 
                  str(exam_path), username, username))
            conn.executemany("""
                INSERT INTO answers (exam_id, question_number, correct_answer, correct_score, incorrect_score, 
                question_type, option_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, [(exam_id, answer.question_number, answer.correct_answer, answer.correct_score, answer.incorrect_score,
                    answer.question_type, answer.option_count) for answer in answers])
        
    except Exception as e:
        if exam_path.exists():
            exam_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create exam: {e}",
        )
    return {"message": "Exam uploaded successfully", "exam_id": exam_id, "answers": [answer.dict() for answer in answers]}

def remove(exam_id: str):
    try:
        with get_connection() as conn:
            cursor = conn.execute("SELECT exam_path FROM exam_catalog WHERE exam_id = ?", (exam_id,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Exam not found")
            exam_path = Path(row[0])
            
            conn.execute("DELETE FROM answers WHERE exam_id = ?", (exam_id,))
            conn.execute("DELETE FROM exam_catalog WHERE exam_id = ?", (exam_id,))
    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting exam from database: {str(e)}",
        )
    if exam_path.exists():
        try:
            exam_path.unlink()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error deleting PDF file: {str(e)}")
    return {"message": "Exam deleted successfully"}

def update(username: str, exam_id: str, body: ExamUpdateRequest):
    with get_connection() as conn:
        query = "UPDATE exam_catalog SET "
        params = []
        
        query_name = "name = ?, " if body.name is not None else ""
        params.append(body.name) if body.name is not None else None
        query_exam_type = "exam_type = ?, " if body.exam_type is not None else ""
        params.append(body.exam_type) if body.exam_type is not None else None
        query_description = "description = ?, " if body.description is not None else ""
        params.append(body.description) if body.description is not None else None
        query_duration = "duration = ?, " if body.duration is not None else ""
        params.append(body.duration) if body.duration is not None else None
        query_updated_at = "updated_at = CURRENT_TIMESTAMP, "
        query_updated_by = "updated_by = ?, "
        params.append(username) 
        query += query_name + query_exam_type + query_description + query_duration + query_updated_at + query_updated_by
        query = query.rstrip(", ") + " WHERE exam_id = ?"
        params.append(exam_id)
        answers = body.answers or []
        for answer in answers:
            if answer.exam_id != exam_id:
                raise HTTPException(status_code=400, detail="Exam ID in answers does not match the exam ID being updated")
            if answer.question_type == 'MCQ':
                if not answer.option_count or answer.option_count not in list(range(1,5)):
                    raise HTTPException(status_code=400, detail="Invalid input")
            else:
                if answer.option_count:
                    raise HTTPException(status_code=400, detail="Invalid input")
        cursor = conn.execute(query, params)
        if not cursor.rowcount:
            raise HTTPException(status_code=404, detail="No exam for this exam_id exists")
        conn.executemany("""
                        UPDATE answers SET correct_answer = ?, correct_score = ?, incorrect_score = ?, 
                        question_type = ?, option_count = ?
                        WHERE exam_id = ? AND question_number = ?
                    """, [(answer.correct_answer, answer.correct_score, answer.incorrect_score,
                            answer.question_type, answer.option_count, answer.exam_id, answer.question_number,) 
                            for answer in answers])
        return {"message": "Exam updated successfully"}

def get_answers(exam_id):
    with get_connection() as conn:
        answers = conn.execute("""SELECT * from answers WHERE exam_id = ?""", [exam_id])
        answers = answers.fetchall()
        if not answers:
            raise HTTPException(status_code=404, detail="Exam not found")
        answers = [
                    Answer(
                        exam_id=answer[0],
                        question_number=answer[1],
                        correct_answer=answer[2],
                        correct_score=answer[3],
                        incorrect_score=answer[4],
                        question_type=answer[5],
                        option_count=answer[6],
                    )
                    for answer in answers
                    ]
        return answers

def get_catalog_items():
    with get_connection() as conn:
        cursor = conn.execute("SELECT exam_id, name, description, duration, total_marks, total_questions, exam_type, created_by FROM exam_catalog")
        rows = cursor.fetchall()
        return [CatalogItem(
            exam_id=row[0],
            name=row[1],
            description=row[2],
            duration=row[3],
            total_marks=row[4],
            total_questions=row[5],
            exam_type=row[6]
        ) for row in rows]





    