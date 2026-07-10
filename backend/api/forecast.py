import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

from api.auth import get_current_user
from db.database import get_db
from api.chat import _user_file_path

router = APIRouter()

class ForecastRequest(BaseModel):
    filename: str
    date_col: str
    value_col: str
    horizon: int = 30
    method: str = "exponential"  # linear | exponential | moving_average

@router.post("/")
def run_dataset_forecast(
    request: ForecastRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_path = _user_file_path(current_user.id, request.filename)
    if not file_path or not os.path.exists(os.path.join("uploads", file_path)):
        raise HTTPException(status_code=404, detail="Dataset file not found")
        
    full_path = os.path.join("uploads", file_path)
    
    try:
        df = pd.read_csv(full_path)
        
        # 1. Parse Date and Value fields
        if request.date_col not in df.columns or request.value_col not in df.columns:
            raise HTTPException(status_code=400, detail="Specified columns do not exist in the dataset")
            
        df[request.date_col] = pd.to_datetime(df[request.date_col], errors='coerce')
        df[request.value_col] = pd.to_numeric(df[request.value_col], errors='coerce')
        
        # Drop null values
        df = df.dropna(subset=[request.date_col, request.value_col])
        
        if len(df) < 5:
            raise HTTPException(status_code=400, detail="Dataset has too few records for forecasting (minimum 5 rows required)")
            
        # 2. Sort and aggregate to group duplicates
        df = df.sort_values(by=request.date_col)
        df_grouped = df.groupby(request.date_col)[request.value_col].mean().reset_index()
        
        history_dates = df_grouped[request.date_col].dt.strftime("%Y-%m-%d").tolist()
        history_values = df_grouped[request.value_col].tolist()
        
        n = len(history_values)
        if n < 3:
            raise HTTPException(status_code=400, detail="Too few unique dates for time-series forecasting")
            
        # 3. Determine time frequency steps
        diffs = df_grouped[request.date_col].diff().dropna()
        if not diffs.empty:
            inferred_diff = diffs.mode()[0]
        else:
            inferred_diff = pd.Timedelta(days=1)
            
        last_date = df_grouped[request.date_col].iloc[-1]
        future_datetime = [last_date + (i + 1) * inferred_diff for i in range(request.horizon)]
        forecast_dates = [d.strftime("%Y-%m-%d") for d in future_datetime]
        
        # 4. Perform Forecast Calculations
        forecast_values = []
        lower_bounds = []
        upper_bounds = []
        std_err = 1.0
        
        raw_values = np.array(history_values)
        x = np.arange(n)
        
        if request.method == "linear":
            # Linear Trend fit
            slope, intercept = np.polyfit(x, raw_values, 1)
            fitted = slope * x + intercept
            residuals = raw_values - fitted
            std_err = float(np.std(residuals)) if len(residuals) > 0 else 1.0
            
            future_x = np.arange(n, n + request.horizon)
            forecast_values = (slope * future_x + intercept).tolist()
            
        elif request.method == "exponential":
            # Simple Exponential Smoothing (SES)
            alpha = 0.3
            smoothed = [raw_values[0]]
            for val in raw_values[1:]:
                smoothed.append(alpha * val + (1 - alpha) * smoothed[-1])
            
            last_smoothed = smoothed[-1]
            forecast_values = [float(last_smoothed)] * request.horizon
            
            residuals = raw_values - np.array(smoothed)
            std_err = float(np.std(residuals)) if len(residuals) > 0 else 1.0
            
        else:  # moving_average
            # Moving Average level projection
            window = min(7, n)
            ma_val = float(np.mean(raw_values[-window:]))
            forecast_values = [ma_val] * request.horizon
            
            fitted = []
            for i in range(n):
                w = min(window, i + 1)
                fitted.append(np.mean(raw_values[i-w+1:i+1]))
            residuals = raw_values - np.array(fitted)
            std_err = float(np.std(residuals)) if len(residuals) > 0 else 1.0
            
        # 5. Widening confidence intervals calculation (95% CI)
        for step, val in enumerate(forecast_values):
            # error scales by square root of steps
            error_step = std_err * np.sqrt(1 + step * 0.1)
            lower_bounds.append(float(round(val - 1.96 * error_step, 2)))
            upper_bounds.append(float(round(val + 1.96 * error_step, 2)))
            forecast_values[step] = float(round(val, 2))
            
        # Round history
        history_values = [float(round(v, 2)) for v in history_values]
        
        # Growth diagnostics
        first_history = history_values[0]
        last_history = history_values[-1]
        last_forecast = forecast_values[-1]
        
        growth_pct = 0.0
        if last_history != 0:
            growth_pct = round(((last_forecast - last_history) / last_history) * 100, 1)
            
        direction = "Stable"
        if growth_pct > 1.5:
            direction = "Upward Growth"
        elif growth_pct < -1.5:
            direction = "Downward Decline"
            
        # 6. Generate Plotly Configuration
        # Shaded Confidence Area trace combined with lines
        plotly_config = {
            "data": [
                # Shaded confidence band (upper bound boundary)
                {
                    "x": forecast_dates + forecast_dates[::-1], # upper dates forward, lower dates reversed
                    "y": upper_bounds + lower_bounds[::-1],
                    "fill": "toself",
                    "fillcolor": "rgba(99, 102, 241, 0.10)",
                    "line": {"color": "transparent"},
                    "name": "95% Confidence Interval",
                    "hoverinfo": "skip",
                    "showlegend": True
                },
                # Historical values trace
                {
                    "x": history_dates,
                    "y": history_values,
                    "type": "scatter",
                    "mode": "lines",
                    "line": {"color": "#6366f1", "width": 2.5},
                    "name": "Historical Level"
                },
                # Forecast values trace
                {
                    "x": forecast_dates,
                    "y": forecast_values,
                    "type": "scatter",
                    "mode": "lines+markers",
                    "line": {"color": "#10b981", "width": 2, "dash": "dash"},
                    "marker": {"size": 4, "color": "#10b981"},
                    "name": f"Forecast ({request.method.capitalize()})"
                }
            ],
            "layout": {
                "title": {"text": f"Metric Forecast Projection: {request.value_col} over {request.horizon} periods"},
                "xaxis": {"title": request.date_col},
                "yaxis": {"title": request.value_col},
                "legend": {"orientation": "h", "y": -0.15}
            }
        }
        
        # 7. Compile tabular projections
        table_forecast = []
        for i in range(request.horizon):
            table_forecast.append({
                "date": forecast_dates[i],
                "prediction": forecast_values[i],
                "range": f"[{lower_bounds[i]} to {upper_bounds[i]}]"
            })
            
        return {
            "summary": {
                "growth_percentage": growth_pct,
                "direction": direction,
                "average_forecast": float(round(np.mean(forecast_values), 2)),
                "inferred_interval": str(inferred_diff)
            },
            "chart_config": plotly_config,
            "projections": table_forecast,
            "columns": {
                "date": request.date_col,
                "value": request.value_col
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast execution failed: {str(e)}")
