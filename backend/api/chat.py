"""
Chat API — protected endpoint that processes user messages through the AI agents
and persists the full Q&A exchange in the ChatMessages table.
"""
import json
import os

from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from api.auth import get_current_user
from api.sessions import upsert_session, UpsertSessionRequest
from db.database import get_db
from db.models import User, ChatSession, ChatMessage

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:    str
    session_id: str
    files:      Optional[List[str]] = []
    agent_mode: Optional[str] = "auto"
    history:    Optional[List[dict]] = []

class ChatResponse(BaseModel):
    message:    str
    chart:      Optional[dict]        = None
    sql:        Optional[str]         = None
    code:       Optional[str]         = None
    insights:   Optional[str]         = None
    reasoning:  Optional[str]         = None
    anomalies:  Optional[List[dict]]  = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_or_create_session(
    session_key: str, user_id: int, active_dataset: Optional[str],
    agent_mode: str, db: Session,
) -> ChatSession:
    session = db.query(ChatSession).filter(
        ChatSession.session_key == session_key,
        ChatSession.user_id == user_id,
    ).first()
    if not session:
        from datetime import datetime
        session = ChatSession(
            user_id=user_id, session_key=session_key,
            session_name=f"Session {datetime.utcnow().strftime('%b %d %H:%M')}",
            active_dataset=active_dataset, agent_mode=agent_mode,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    else:
        if active_dataset:
            session.active_dataset = active_dataset
        session.agent_mode = agent_mode
        from datetime import datetime
        session.updated_at = datetime.utcnow()
        db.commit()
    return session


def _save_message(
    session: ChatSession, sender: str, text: str,
    agent_mode: str, extras: dict, db: Session,
) -> None:
    msg = ChatMessage(
        session_id=session.id,
        sender=sender,
        text=text,
        agent_mode=agent_mode,
        extras_json=json.dumps(extras) if extras else None,
    )
    db.add(msg)
    db.commit()


def _user_file_path(user_id: int, filename: str) -> str:
    """Resolve the path of the user's uploaded CSV relative to 'uploads/'."""
    user_rel_path = os.path.join(str(user_id), filename)
    base = os.path.join("uploads", user_rel_path)
    if os.path.exists(base):
        return user_rel_path
    # Fallback: legacy flat uploads/ (pre-auth files)
    legacy = os.path.join("uploads", filename)
    if os.path.exists(legacy):
        return filename
    return user_rel_path


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ── 1. Memory / session setup ─────────────────────────────────────────────
    from agents.memory_agent import save_message, get_message_history, save_session_state, load_session_state

    session_meta = load_session_state(request.session_id)
    active_files = []
    if request.files:
        active_files = request.files
        save_session_state(request.session_id, ",".join(active_files))
    elif session_meta.get("current_dataset"):
        active_files = [f.strip() for f in session_meta["current_dataset"].split(",") if f.strip()]

    # ── 2. Ensure DB session row exists ──────────────────────────────────────
    db_session = _get_or_create_session(
        session_key=request.session_id,
        user_id=current_user.id,
        active_dataset=",".join(active_files),
        agent_mode=request.agent_mode or "auto",
        db=db,
    )

    # ── 3. Build conversation context from memory ────────────────────────────
    history    = get_message_history(request.session_id, limit=20)
    context    = ""
    if history:
        context = "Conversation History:\n"
        for msg in history:
            role     = "User" if msg.type == "human" else "AI Analyst"
            context += f"{role}: {msg.content}\n"
        context += "\n"

    final_message = f"{context}Current Request:\n{request.message}"

    # ── 4. Persist incoming user message ─────────────────────────────────────
    save_message(request.session_id, "user", request.message)
    _save_message(db_session, "user", request.message, request.agent_mode or "auto", {}, db)

    from db.models import Dataset
    user_datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).all()
    datasets_list = []
    
    for f in active_files:
        resolved = _user_file_path(current_user.id, f)
        if resolved:
            datasets_list.append(resolved)
            
    # Fallback to all user datasets if selection is empty
    if not datasets_list:
        for d in user_datasets:
            resolved = _user_file_path(current_user.id, d.filename)
            if resolved and resolved not in datasets_list:
                datasets_list.append(resolved)

    # Resolve primary dataset for general fallback compatibility
    primary_dataset = active_files[0] if active_files else (user_datasets[0].filename if user_datasets else None)
    file_path = _user_file_path(current_user.id, primary_dataset) if primary_dataset else None

    # Build agent state
    state = {
        "messages":       [HumanMessage(content=final_message)],
        "session_id":     request.session_id,
        "datasets":       datasets_list,
        "current_dataset": file_path,
    }

    try:
        mode         = request.agent_mode
        response_obj = None

        if mode == "sql":
            from agents.sql_agent import sql_node
            result = sql_node(state)
            if "error" in result:
                raise Exception(result["error"])
            reply = result.get("reply") or f"SQL query executed for: {request.message.strip()}"
            response_obj = ChatResponse(
                message=reply, sql=result.get("sql_query"),
                reasoning=result.get("reasoning", "SQL Agent."),
            )

        elif mode == "pandas":
            from agents.analysis_agent import analysis_node
            result = analysis_node(state)
            if "error" in result:
                raise Exception(result["error"])
            reply = result.get("reply") or "Python/Pandas code executed."
            response_obj = ChatResponse(
                message=reply, code=result.get("pandas_code"),
                insights=result.get("insights"),
                reasoning=result.get("reasoning", "Pandas Agent."),
            )

        elif mode == "graph":
            from agents.chart_agent import chart_node
            result = chart_node(state)
            if "error" in result:
                raise Exception(result["error"])
            reply = result.get("reply") or "Visualization created."
            response_obj = ChatResponse(
                message=reply, chart=result.get("chart_config"),
                reasoning=result.get("reasoning", "Graph Agent."),
            )

        elif mode == "anomaly":
            from agents.anomaly_agent import anomaly_node
            result = anomaly_node(state)
            if "error" in result:
                raise Exception(result["error"])
            interpretation = result.get("insights", "")
            reply = interpretation or f"Anomaly detection: {len(result.get('anomalies') or [])} anomalous record(s)."
            response_obj = ChatResponse(
                message=reply, anomalies=result.get("anomalies"),
                insights=interpretation,
                reasoning=result.get("reasoning", "Anomaly Agent."),
            )

        elif mode == "insights":
            from agents.insight_agent import insight_node
            state["anomalies"] = []
            result = insight_node(state)
            if "error" in result:
                raise Exception(result["error"])
            reply = result.get("reply") or result.get("insights") or "Insights generated."
            response_obj = ChatResponse(
                message=reply, insights=result.get("insights"),
                reasoning=result.get("reasoning", "Insight Agent."),
            )

        else:  # auto / general chatbot
            from agents.general_agent import general_chatbot_node
            result = general_chatbot_node(state)
            if "error" in result:
                raise Exception(result["error"])
            reply = result.get("reply") or "Analysis complete."
            response_obj = ChatResponse(
                message=reply, insights=result.get("insights"),
                reasoning=result.get("reasoning", "General Agent."),
            )

        if response_obj:
            # ── 6. Persist AI response ────────────────────────────────────────
            save_message(request.session_id, "ai", response_obj.message)
            extras = {
                k: v for k, v in {
                    "chart":     response_obj.chart,
                    "sql":       response_obj.sql,
                    "code":      response_obj.code,
                    "insights":  response_obj.insights,
                    "anomalies": response_obj.anomalies,
                }.items() if v
            }
            _save_message(db_session, "ai", response_obj.message, mode or "auto", extras, db)
            return response_obj

        raise Exception("No response generated.")

    except Exception as e:
        err_msg = f"I encountered an error while processing your request: {str(e)}"
        save_message(request.session_id, "ai", err_msg)
        _save_message(db_session, "ai", err_msg, mode or "auto", {"reasoning": str(e)}, db)
        return ChatResponse(message=err_msg, reasoning=f"Error trace: {str(e)}")
