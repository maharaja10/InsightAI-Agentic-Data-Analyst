import os
import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from api.auth import get_current_user
from db.database import get_db
from api.chat import _user_file_path

router = APIRouter()

@router.get("/{filename}")
def get_dataset_quality_profile(
    filename: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_path = _user_file_path(current_user.id, filename)
    if not file_path or not os.path.exists(os.path.join("uploads", file_path)):
        raise HTTPException(status_code=404, detail="Dataset file not found")
        
    full_path = os.path.join("uploads", file_path)
    
    try:
        df = pd.read_csv(full_path)
        
        num_rows = len(df)
        num_cols = len(df.columns)
        
        if num_rows == 0:
            return {
                "filename": filename,
                "health_score": 0.0,
                "summary": {
                    "total_rows": 0,
                    "total_cols": num_cols,
                    "duplicate_rows": 0,
                    "duplicate_percentage": 0.0
                },
                "columns": [],
                "outliers": [],
                "warnings_count": 1,
                "general_warnings": ["Dataset is completely empty (0 rows)."]
            }
            
        # 1. Duplication Rate
        duplicate_rows = int(df.duplicated().sum())
        duplicate_percentage = round((duplicate_rows / num_rows) * 100, 1)
        
        # Deductions tracking
        deductions = 0.0
        
        # Duplicates deduction: max 15 points
        deductions += min(15.0, (duplicate_percentage / 100.0) * 30.0)
        
        # 2. Columns Audit
        columns_metrics = []
        mixed_types_cols_count = 0
        high_null_cols_count = 0
        total_cells = num_rows * num_cols
        total_null_cells = 0
        
        for col in df.columns:
            dtype_str = str(df[col].dtype)
            null_count = int(df[col].isnull().sum())
            total_null_cells += null_count
            null_percentage = round((null_count / num_rows) * 100, 1)
            unique_count = int(df[col].nunique())
            
            col_warnings = []
            
            # Checks
            if null_percentage == 100.0:
                col_warnings.append("Column is entirely empty")
                high_null_cols_count += 1
            elif null_percentage > 30.0:
                col_warnings.append(f"High missing values rate ({null_percentage}%)")
                high_null_cols_count += 1
                
            if unique_count == 1:
                col_warnings.append("Constant column (only has 1 unique value)")
                
            # Mixed type check
            non_null_vals = df[col].dropna()
            if not non_null_vals.empty:
                val_types = non_null_vals.map(type).unique()
                if len(val_types) > 1:
                    col_warnings.append("Mixed data types detected in values")
                    mixed_types_cols_count += 1
                    
            columns_metrics.append({
                "name": col,
                "type": dtype_str,
                "null_count": null_count,
                "null_percentage": null_percentage,
                "unique_count": unique_count,
                "warnings": col_warnings
            })
            
        # Cell missing value deduction: max 25 points
        null_rate = (total_null_cells / total_cells) if total_cells > 0 else 0.0
        deductions += null_rate * 25.0
        
        # Mixed types deduction: 5 points per col (max 15 points)
        deductions += min(15.0, mixed_types_cols_count * 5.0)
        
        # High null columns deduction: 2 points per col (max 10 points)
        deductions += min(10.0, high_null_cols_count * 2.0)
        
        # 3. Outlier Analysis (Numeric Columns IQR)
        outlier_metrics = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        high_outlier_cols_count = 0
        
        for col in numeric_cols:
            non_null_col = df[col].dropna()
            if len(non_null_col) < 5:
                continue
                
            q25 = non_null_col.quantile(0.25)
            q75 = non_null_col.quantile(0.75)
            iqr = q75 - q25
            
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            
            # Count outliers
            outliers_count = int(((non_null_col < lower_bound) | (non_null_col > upper_bound)).sum())
            outlier_rate = round((outliers_count / len(non_null_col)) * 100, 1)
            
            if outliers_count > 0:
                outlier_metrics.append({
                    "column": col,
                    "count": outliers_count,
                    "percentage": outlier_rate,
                    "lower_bound": float(round(lower_bound, 2)),
                    "upper_bound": float(round(upper_bound, 2))
                })
                if outlier_rate > 10.0:
                    high_outlier_cols_count += 1
                    
        # Outliers deduction: 5 points per high outlier column (max 15 points)
        deductions += min(15.0, high_outlier_cols_count * 5.0)
        
        # Final Score calculation
        health_score = round(max(0.0, 100.0 - deductions), 1)
        
        # Gather aggregate warnings count
        warnings_count = duplicate_rows + mixed_types_cols_count + high_null_cols_count + len(outlier_metrics)
        
        return {
            "filename": filename,
            "health_score": health_score,
            "summary": {
                "total_rows": num_rows,
                "total_cols": num_cols,
                "duplicate_rows": duplicate_rows,
                "duplicate_percentage": duplicate_percentage,
                "missing_cells_percentage": round(null_rate * 100, 1)
            },
            "columns": columns_metrics,
            "outliers": outlier_metrics,
            "warnings_count": warnings_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate quality profile: {str(e)}")
