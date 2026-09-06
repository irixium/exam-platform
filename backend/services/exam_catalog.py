from pathlib import Path

from schemas.exam_catalog import CatalogItem, Answer
from database import get_connection
from fastapi import UploadFile, File, HTTPException, Form
import csv
from io import StringIO
import uuid
from pypdf import PdfReader

def parse_catalog_item(
    exam_id: str = Form(...),
    name: str = Form(...),
    exam_type: str = Form(...),
    description: str = Form(""),
    duration: int = Form(...),
    total_marks: int = Form(...),
) -> CatalogItem:
    return CatalogItem(
        exam_id=exam_id,
        name=name,
        exam_type=exam_type,
        description=description,
        duration=duration,
        total_marks=total_marks
    )


async def upload(data: CatalogItem, exam_doc: UploadFile, key_csv: UploadFile, username: str):
    if exam_doc.content_type != "application/pdf":
        raise HTTPException(400, "File must be a PDF")
    try:
        await exam_doc.seek(0)
        reader = PdfReader(exam_doc.file)
        len(reader.pages)
    except Exception:
        raise HTTPException(400, "Invalid or corrupted PDF")
    finally:
        await exam_doc.seek(0)

    if not key_csv.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Invalid file type for answer key. Please upload a CSV file.")
    with get_connection() as conn:
        user_id = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user_id:
            raise HTTPException(status_code=400, detail="User not found")
        user_id = user_id[0]
        
    try:
        content = await key_csv.read()
        content = content.decode("utf-8")
        rows = list(csv.DictReader(StringIO(content)))
        exam_id = str(uuid.uuid4())

        answers = [
            Answer(
                **row,
                exam_id=exam_id,
            )
            for row in rows
        ]

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
                INSERT INTO exam_catalog (exam_id, name, exam_type, description, duration, total_marks, exam_path, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (exam_id, data.name, data.exam_type, data.description, data.duration, data.total_marks, str(exam_path), user_id))
            conn.executemany("""
                INSERT INTO answers (exam_id, question_number, correct_answer)
                VALUES (?, ?, ?)
            """, [(exam_id, answer.question_number, answer.correct_answer) for answer in answers])
    except Exception as e:
        if exam_path.exists():
            exam_path.unlink()
        raise HTTPException(
            status_code=500,
            detail="Failed to create exam",
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

def get_catalog_items():
    with get_connection() as conn:
        cursor = conn.execute("SELECT exam_id, name, description, duration, total_marks, created_by FROM exam_catalog")
        rows = cursor.fetchall()
        return [CatalogItem(
            exam_id=row[0],
            name=row[1],
            description=row[2],
            duration=row[3],
            total_marks=row[4],
            created_by=row[5],
        ) for row in rows]



    