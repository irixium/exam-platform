from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from schemas.exam_catalog import CatalogItem, ExamUpdateRequest, Answer, ExamUploadRequest
from schemas.auth import AuthenticatedUser
from services.exam_catalog import get_catalog_items, remove, upload, parse_catalog_item, update, get_answers
from services.auth import get_current_user
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-exam")
async def upload_exam(data: ExamUploadRequest = Depends(parse_catalog_item), 
                      exam_doc: UploadFile = File(...), 
                      key_csv: UploadFile = File(...), 
                      user_info: AuthenticatedUser = Depends(get_current_user)):
    username, is_admin = user_info.username, user_info.is_admin
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload exams",
        )
    result = await upload(data, exam_doc, key_csv, username)
    return result

@router.delete("/delete-exam/{exam_id}")
def delete_exam(exam_id: str, user_info: AuthenticatedUser = Depends(get_current_user)):
    is_admin = user_info.is_admin
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can delete exams",
        )
    return remove(exam_id)


@router.get("/exam-list", response_model=list[CatalogItem], dependencies=[Depends(get_current_user)])
def get_catalog():
    return get_catalog_items()

@router.patch("/update-exam/{exam_id}")
def update_exam(exam_id: str, body: ExamUpdateRequest, user_info: AuthenticatedUser = Depends(get_current_user)):
    username, is_admin = user_info.username, user_info.is_admin
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can update exams",
        )
    return update(username, exam_id, body)

@router.get("/answers/{exam_id}", response_model=list[Answer])
def get_exam_answers(exam_id: str, user_info: AuthenticatedUser = Depends(get_current_user)):
    is_admin = user_info.is_admin
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view answers",
        )
    return get_answers(exam_id)