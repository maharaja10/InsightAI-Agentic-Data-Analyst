import os
import sqlite3
from langchain_core.messages import HumanMessage, AIMessage

# Path to local SQLite memory database inside backend/memory/
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "memory", "chat_memory.db")

def init_db():
    """Initializes SQLite database tables for chat logs and session metadata."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        sender TEXT,
        message_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS session_state (
        session_id TEXT PRIMARY KEY,
        current_dataset TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    conn.close()

def save_message(session_id: str, sender: str, text: str):
    """Saves a single message (user or AI) to the session database."""
    init_db()
    if not text:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_history (session_id, sender, message_text) VALUES (?, ?, ?)",
        (session_id, sender, text)
    )
    conn.commit()
    conn.close()

def get_message_history(session_id: str, limit: int = 20) -> list:
    """Loads the last N messages for a session formatted as LangChain message models."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Fetch last N messages and arrange chronologically (ASC)
    cursor.execute(
        "SELECT sender, message_text FROM (SELECT id, sender, message_text FROM chat_history WHERE session_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC",
        (session_id, limit)
    )
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for sender, text in rows:
        if sender == "user":
            messages.append(HumanMessage(content=text))
        else:
            messages.append(AIMessage(content=text))
    return messages

def save_session_state(session_id: str, dataset_name: str):
    """Saves session metadata, specifically the active dataset."""
    init_db()
    if not dataset_name:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO session_state (session_id, current_dataset, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        (session_id, dataset_name)
    )
    conn.commit()
    conn.close()

def load_session_state(session_id: str) -> dict:
    """Recovers metadata for a session, returning a dictionary containing the active dataset."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT current_dataset FROM session_state WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"current_dataset": row[0]}
    return {}

def clear_session_history(session_id: str):
    """Clears conversation and metadata logs for a given session."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
    cursor.execute("DELETE FROM session_state WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()
