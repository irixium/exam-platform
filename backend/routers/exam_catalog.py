from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from schemas.exam_catalog import CatalogItem, Question
from services.exam_catalog import get_catalog_items, upload
import csv
from io import StringIO
router = APIRouter()

@router.post("/upload-csv")
def upload_exam(data: CatalogItem, csv_file: UploadFile = File(...)):
    return upload(data, csv_file)


    


@router.get("/exam-list", response_model=list[CatalogItem])
def get_catalog():
    return get_catalog_items()