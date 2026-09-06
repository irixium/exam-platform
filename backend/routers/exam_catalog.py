from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from schemas.exam_catalog import CatalogItem
from services.exam_catalog import get_catalog_items, remove, upload, parse_catalog_item, get_question_list
from services.auth import get_current_user
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-exam")
async def upload_exam(data: CatalogItem = Depends(parse_catalog_item), exam_doc: UploadFile = File(...), key_csv: UploadFile = File(...), user_info: tuple = Depends(get_current_user)):
    username, is_admin = user_info
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload exams",
        )
    result = await upload(data, exam_doc, key_csv, username)
    return result

@router.delete("/delete-exam/{exam_id}")
def delete_exam(exam_id: str, user_info: tuple = Depends(get_current_user)):
    user_id, is_admin = user_info
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete exams",
        )
    result = remove(exam_id)
    return {"message": "Exam deleted successfully"}


@router.get("/exam-list", response_model=list[CatalogItem])
def get_catalog(user: str = Depends(get_current_user)):
    return get_catalog_items()

@router.get("/question-list/{attempt_id}")
def get_questions(attempt_id: str, user_info: tuple = Depends(get_current_user)):
    username, is_admin = user_info
    return get_question_list(attempt_id, username)