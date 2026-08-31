from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from schemas.exam_catalog import CatalogItem, Question
from services.exam_catalog import get_catalog_items, upload
from main import get_current_user
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-csv")
def upload_exam(data: CatalogItem, csv_file: UploadFile = File(...), user_info: tuple = Depends(get_current_user)):
    username, is_admin = user_info
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload exams",
        )
    return upload(data, csv_file)


    


@router.get("/exam-list", response_model=list[CatalogItem])
def get_catalog(user: str = Depends(get_current_user)):
    return get_catalog_items()