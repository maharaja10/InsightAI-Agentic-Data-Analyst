import os
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from api.auth import get_current_user
from db.database import get_db
from db.models import Dataset, ChatSession, ChatMessage

router = APIRouter()

@router.get("/stats/")
def get_user_operational_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get user session IDs
    user_sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
    user_session_ids = [s.id for s in user_sessions]
    
    # 1. Summary Numbers
    total_datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).count()
    total_sessions = len(user_sessions)
    
    total_user_msg = 0
    total_ai_msg = 0
    avg_query_len = 0
    anomalies_detected = 0
    
    if user_session_ids:
        total_user_msg = db.query(ChatMessage).filter(ChatMessage.session_id.in_(user_session_ids), ChatMessage.sender == "user").count()
        total_ai_msg = db.query(ChatMessage).filter(ChatMessage.session_id.in_(user_session_ids), ChatMessage.sender == "ai").count()
        
        # Average character length
        avg_len_res = db.query(func.avg(func.length(ChatMessage.text))).filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.sender == "user"
        ).scalar()
        if avg_len_res:
            avg_query_len = round(avg_len_res, 1)
            
        # Count anomalies detected in chat responses
        anomalies_res = db.query(ChatMessage).filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.sender == "ai",
            ChatMessage.extras_json.like("%anomalies%")
        ).count()
        anomalies_detected = anomalies_res
    
    # 2. Agent Usage Distribution (Donut Chart)
    agent_labels = []
    agent_values = []
    agent_table_metrics = []
    
    mode_labels = {
        "auto": "General Agent",
        "sql": "SQL Agent",
        "pandas": "Pandas Agent",
        "graph": "Graph Agent",
        "anomaly": "Anomaly Agent",
        "insights": "Insights Agent"
    }
    
    if user_session_ids:
        agent_counts = db.query(
            ChatMessage.agent_mode,
            func.count(ChatMessage.id),
            func.avg(func.length(ChatMessage.text))
        ).filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.sender == "user"
        ).group_by(ChatMessage.agent_mode).all()
        
        for mode, count, avg_len in agent_counts:
            label = mode_labels.get(mode or "auto", "General Agent")
            agent_labels.append(label)
            agent_values.append(count)
            agent_table_metrics.append({
                "agent": label,
                "queries": count,
                "avg_length": round(avg_len or 0, 1)
            })
            
    if not agent_values:
        agent_labels = ["General Agent", "SQL Agent", "Pandas Agent"]
        agent_values = [0, 0, 0]
        
    donut_chart = {
        "title": "AI Agent Distribution Share",
        "config": {
            "data": [{
                "labels": agent_labels,
                "values": agent_values,
                "type": "pie",
                "hole": 0.4,
                "marker": {"colors": ["#6366f1", "#06b6d4", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"]}
            }],
            "layout": {
                "title": {"text": "AI Agent Usage Share"}
            }
        }
    }
    
    # 3. Activity Timeline Chart (Last 7 Days)
    today = datetime.utcnow().date()
    date_map = {}
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        date_map[d_str] = 0
        
    if user_session_ids:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        timeline_data = db.query(
            func.strftime("%Y-%m-%d", ChatMessage.timestamp).label("date"),
            func.count(ChatMessage.id).label("count")
        ).filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.sender == "user",
            ChatMessage.timestamp >= seven_days_ago
        ).group_by("date").all()
        
        for date_str, count in timeline_data:
            if date_str in date_map:
                date_map[date_str] = count
                
    timeline_dates = list(date_map.keys())
    timeline_counts = list(date_map.values())
    
    line_chart = {
        "title": "Conversational Activities Timeline (Last 7 Days)",
        "config": {
            "data": [{
                "x": timeline_dates,
                "y": timeline_counts,
                "type": "scatter",
                "mode": "lines+markers",
                "line": {"color": "#10b981", "width": 2.5},
                "marker": {"size": 6, "color": "#10b981"}
            }],
            "layout": {
                "title": {"text": "Queries Executed per Day"},
                "xaxis": {"title": "Date"},
                "yaxis": {"title": "Queries Count"}
            }
        }
    }
    
    # 4. Hourly Activity Heatmap / Hourly distribution
    hour_map = {f"{h:02d}:00": 0 for h in range(24)}
    if user_session_ids:
        hourly_data = db.query(
            func.strftime("%H", ChatMessage.timestamp).label("hour"),
            func.count(ChatMessage.id).label("count")
        ).filter(
            ChatMessage.session_id.in_(user_session_ids),
            ChatMessage.sender == "user"
        ).group_by("hour").all()
        
        for hr_str, count in hourly_data:
            hr_key = f"{int(hr_str):02d}:00"
            if hr_key in hour_map:
                hour_map[hr_key] = count
                
    hourly_chart = {
        "title": "Hourly Activity Distribution Profile",
        "config": {
            "data": [{
                "x": list(hour_map.keys()),
                "y": list(hour_map.values()),
                "type": "bar",
                "marker": {"color": "#6366f1"}
            }],
            "layout": {
                "title": {"text": "Queries Count by Hour of Day"},
                "xaxis": {"title": "Time of Day"},
                "yaxis": {"title": "Queries count"}
            }
        }
    }
    
    # 5. Recent Operations
    recent_ops = []
    if user_session_ids:
        recent_msgs = db.query(
            ChatMessage, ChatSession.session_name
        ).join(
            ChatSession, ChatMessage.session_id == ChatSession.id
        ).filter(
            ChatSession.user_id == current_user.id,
            ChatMessage.sender == "user"
        ).order_by(ChatMessage.id.desc()).limit(10).all()
        
        for msg, session_name in recent_msgs:
            recent_ops.append({
                "session_name": session_name or "Unnamed Session",
                "agent_mode": msg.agent_mode or "auto",
                "text": msg.text,
                "timestamp": msg.timestamp.strftime("%Y-%m-%d %H:%M")
            })
            
    return {
        "summary": {
            "total_datasets": total_datasets,
            "total_sessions": total_sessions,
            "total_user_messages": total_user_msg,
            "total_ai_responses": total_ai_msg,
            "avg_query_len": avg_query_len,
            "anomalies_detected": anomalies_detected
        },
        "charts": [donut_chart, line_chart, hourly_chart],
        "agent_metrics": agent_table_metrics,
        "recent_operations": recent_ops
    }


@router.get("/logs/")
def get_agent_execution_logs(
    current_user = Depends(get_current_user),
):
    """
    Tails the last 50 lines of the agent execution log file.
    Protected: requires valid user JWT token.
    """
    from utils.logger import LOG_FILE
    if not os.path.exists(LOG_FILE):
        return []
        
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        # Get last 50 lines
        last_lines = lines[-50:]
        
        # Parse into structured objects
        parsed_logs = []
        for line in last_lines:
            line = line.strip()
            if not line:
                continue
            parsed_logs.append(line)
            
        return parsed_logs
    except Exception as e:
        return [f"Error reading logs: {str(e)}"]


def run_evals_background():
    try:
        from run_evals import run_evaluations
        run_evaluations()
    except Exception as e:
        print(f"[Evals Background Error] Failed to run evaluations: {str(e)}")


@router.post("/evals/run")
def trigger_evals_suite(
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
):
    """
    Triggers the automated evaluations suite in a background task.
    """
    background_tasks.add_task(run_evals_background)
    return {"message": "Model evaluation suite triggered in the background."}


@router.get("/evals/")
def get_model_evaluation_report(
    current_user = Depends(get_current_user),
):
    """
    Returns the latest compiled model evaluation JSON report.
    """
    import json
    evals_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "evals_report.json")
    if not os.path.exists(evals_file):
        # Return default mock metrics to represent system readiness
        return {
            "timestamp": "Never executed",
            "metrics": {
                "total_tests": 0,
                "passed_tests": 0,
                "pass_rate": 0.0,
                "avg_latency": 0.0
            },
            "test_cases": []
        }
        
    try:
        with open(evals_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read evals report: {str(e)}")


@router.post("/cache/clear")
def clear_query_cache(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clears all cached query results for the current user in QueryCache.
    """
    from db.models import QueryCache
    try:
        db.query(QueryCache).filter(QueryCache.user_id == current_user.id).delete()
        db.commit()
        return {"message": "Query cache cleared successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear query cache: {str(e)}")
