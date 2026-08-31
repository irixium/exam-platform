from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from schemas.exam_catalog import CatalogItem, Question
from services.exam_catalog import get_catalog_items, upload, parse_catalog_item
from services.auth import get_current_user
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-csv")
async def upload_exam(data: CatalogItem = Depends(parse_catalog_item), csv_file: UploadFile = File(...), user_info: tuple = Depends(get_current_user)):
    username, is_admin = user_info
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only admins can upload exams",
        )
    result = await upload(data, csv_file)
    return result


@router.get("/exam-list", response_model=list[CatalogItem])
def get_catalog(user: str = Depends(get_current_user)):
    return get_catalog_items()