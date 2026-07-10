"""
Sessions API — list, retrieve, create and delete user chat sessions.
  GET    /api/sessions/          — list all sessions for current user
  POST   /api/sessions/          — ensure a session row exists (upsert by session_key)
  GET    /api/sessions/{key}     — load full session + messages
  DELETE /api/sessions/{key}     — delete session + all its messages
"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import ChatSession, ChatMessage, User
from api.auth import get_current_user

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class MessageOut(BaseModel):
    id:         int
    sender:     str
    text:       str
    agent_mode: Optional[str]
    extras:     dict
    timestamp:  datetime

    class Config:
        from_attributes = True

class SessionOut(BaseModel):
    id:            int
    session_key:   str
    session_name:  Optional[str]
    active_dataset:Optional[str]
    agent_mode:    str
    created_at:    datetime
    updated_at:    datetime
    message_count: int

class SessionDetail(SessionOut):
    messages: List[MessageOut]

class UpsertSessionRequest(BaseModel):
    session_key:   str
    session_name:  Optional[str] = None
    active_dataset:Optional[str] = None
    agent_mode:    Optional[str] = "auto"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _session_out(s: ChatSession) -> SessionOut:
    return SessionOut(
        id=s.id, session_key=s.session_key, session_name=s.session_name,
        active_dataset=s.active_dataset, agent_mode=s.agent_mode or "auto",
        created_at=s.created_at, updated_at=s.updated_at,
        message_count=len(s.messages),
    )

def _msg_out(m: ChatMessage) -> MessageOut:
    return MessageOut(
        id=m.id, sender=m.sender, text=m.text,
        agent_mode=m.agent_mode, extras=m.get_extras(), timestamp=m.timestamp,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/", response_model=List[SessionOut])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [_session_out(s) for s in sessions]


@router.post("/", response_model=SessionOut, status_code=200)
def upsert_session(
    req: UpsertSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create if not exists, otherwise update metadata."""
    session = db.query(ChatSession).filter(
        ChatSession.session_key == req.session_key,
        ChatSession.user_id == current_user.id,
    ).first()

    if not session:
        session = ChatSession(
            user_id=current_user.id,
            session_key=req.session_key,
            session_name=req.session_name or f"Session {datetime.utcnow().strftime('%b %d %H:%M')}",
            active_dataset=req.active_dataset,
            agent_mode=req.agent_mode or "auto",
        )
        db.add(session)
    else:
        if req.active_dataset is not None:
            session.active_dataset = req.active_dataset
        if req.agent_mode:
            session.agent_mode = req.agent_mode
        session.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(session)
    return _session_out(session)


@router.get("/{session_key}", response_model=SessionDetail)
def get_session(
    session_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(
        ChatSession.session_key == session_key,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return SessionDetail(
        **_session_out(session).model_dump(),
        messages=[_msg_out(m) for m in session.messages],
    )


@router.delete("/{session_key}", status_code=204)
def delete_session(
    session_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(
        ChatSession.session_key == session_key,
        ChatSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    db.delete(session)
    db.commit()
