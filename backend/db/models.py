"""
ORM Models for InsightAI:
  User          — registered accounts
  Dataset       — uploaded CSV files (user-scoped)
  ChatSession   — a named conversation tied to a user + dataset
  ChatMessage   — individual messages inside a session (with extras JSON)
"""
import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship
from db.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name  = Column(String(100), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    is_active     = Column(Boolean, default=True)

    datasets      = relationship("Dataset",     back_populates="owner",   cascade="all, delete-orphan")
    sessions      = relationship("ChatSession", back_populates="owner",   cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename      = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=True)
    uploaded_at   = Column(DateTime, default=datetime.utcnow)

    owner         = relationship("User", back_populates="datasets")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_key   = Column(String(64), unique=True, index=True, nullable=False)  # random session_id from frontend
    session_name  = Column(String(255), nullable=True)
    active_dataset= Column(String(255), nullable=True)
    agent_mode    = Column(String(32),  default="auto")
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner         = relationship("User",        back_populates="sessions")
    messages      = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id            = Column(Integer, primary_key=True, index=True)
    session_id    = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    sender        = Column(String(10), nullable=False)   # 'user' | 'ai'
    text          = Column(Text, nullable=False)
    agent_mode    = Column(String(32), nullable=True)
    extras_json   = Column(Text, nullable=True)          # JSON: chart, sql, code, insights, anomalies
    timestamp     = Column(DateTime, default=datetime.utcnow)

    session       = relationship("ChatSession", back_populates="messages")

    def get_extras(self) -> dict:
        if self.extras_json:
            try:
                return json.loads(self.extras_json)
            except Exception:
                return {}
        return {}
