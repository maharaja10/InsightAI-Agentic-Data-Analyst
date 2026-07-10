"""
Upload API — stores CSV files in a per-user folder and records them in the DB.
Protected: requires valid JWT token.
"""
import os
import shutil

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from api.auth import get_current_user
from db.database import get_db
from db.models import Dataset, User

router = APIRouter()

BASE_UPLOAD_DIR = "uploads"
os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")

    # User-scoped upload directory
    user_dir = os.path.join(BASE_UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    file_path = os.path.join(user_dir, file.filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Basic CSV validation
        df = pd.read_csv(file_path, nrows=5)
        columns = df.columns.tolist()

        # Upsert Dataset row (avoid duplicates on re-upload)
        existing = db.query(Dataset).filter(
            Dataset.user_id == current_user.id,
            Dataset.filename == file.filename,
        ).first()
        if not existing:
            db.add(Dataset(
                user_id=current_user.id,
                filename=file.filename,
                original_name=file.filename,
            ))
            db.commit()

        return {
            "message": f"Successfully uploaded {file.filename}",
            "filename": file.filename,
            "columns": columns,
            "rows_preview": len(df),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
def list_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all datasets uploaded by the current user."""
    datasets = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.uploaded_at.desc())
        .all()
    )
    return [
        {
            "filename": d.filename,
            "uploaded_at": d.uploaded_at.isoformat(),
        }
        for d in datasets
    ]
