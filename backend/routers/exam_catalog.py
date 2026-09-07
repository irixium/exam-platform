from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from schemas.exam_catalog import CatalogItem
from schemas.auth import AuthenticatedUser
from services.exam_catalog import get_catalog_items, remove, upload, parse_catalog_item
from services.auth import get_current_user
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-exam")
async def upload_exam(data: CatalogItem = Depends(parse_catalog_item), 
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
    result = remove(exam_id)
    return {"message": "Exam deleted successfully"}


@router.get("/exam-list", response_model=list[CatalogItem], dependencies=[Depends(get_current_user)])
def get_catalog():
    return get_catalog_items()

