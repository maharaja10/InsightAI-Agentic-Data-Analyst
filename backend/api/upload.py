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


from pydantic import BaseModel
from typing import List

class SchemaSearchRequest(BaseModel):
    query: str

@router.post("/search")
def search_schemas(
    request: SchemaSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search for columns and fields matching a term across all of the user's uploaded datasets.
    Uses lightweight TF-IDF character n-gram cosine similarity.
    """
    datasets = (
        db.query(Dataset)
        .filter(Dataset.user_id == current_user.id)
        .all()
    )
    if not datasets:
        return []

    query_str = request.query.strip().lower()
    if not query_str:
        return []

    matches = []
    
    # User-scoped upload directory helper
    user_dir = os.path.join(BASE_UPLOAD_DIR, str(current_user.id))

    for d in datasets:
        file_path = os.path.join(user_dir, d.filename)
        # Legacy fallback if user directory isn't initialized yet
        if not os.path.exists(file_path):
            file_path = os.path.join(BASE_UPLOAD_DIR, d.filename)
            if not os.path.exists(file_path):
                continue

        try:
            # Load only the first few rows to build schema without memory overhead
            df = pd.read_csv(file_path, nrows=5)
            columns = df.columns.tolist()
            
            for col in columns:
                col_lower = col.lower()
                col_type = str(df[col].dtype)
                
                # Extract first few unique non-null values for display preview
                sample_vals = df[col].dropna().unique().tolist()
                sample_preview = [str(x) for x in sample_vals[:3]]

                # Calculate a simple similarity score
                # 1. Exact string match or substring match (high score)
                if query_str == col_lower:
                    score = 1.0
                elif query_str in col_lower:
                    score = 0.8
                else:
                    # 2. Character-level n-gram overlap
                    from sklearn.feature_extraction.text import TfidfVectorizer
                    from sklearn.metrics.pairwise import cosine_similarity
                    try:
                        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
                        tfidf = vectorizer.fit_transform([col_lower, query_str])
                        score = float(cosine_similarity(tfidf[0], tfidf[1])[0][0])
                    except Exception:
                        score = 0.0

                if score > 0.25:
                    matches.append({
                        "filename": d.filename,
                        "column": col,
                        "type": col_type,
                        "score": round(score, 4),
                        "sample": sample_preview
                    })
        except Exception as e:
            print(f"Error parsing schema for file {d.filename}: {str(e)}")
            continue

    # Sort matches by similarity score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:12]
