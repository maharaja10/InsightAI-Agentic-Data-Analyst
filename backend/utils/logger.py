import os
import threading
from datetime import datetime

LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
LOG_FILE = os.path.join(LOGS_DIR, "agent_execution.log")

# Thread lock to prevent concurrent write issues
_log_lock = threading.Lock()

def log_agent_action(agent_name: str, session_key: str, action: str, details: str = ""):
    """
    Format and append an agent action trace to backend/logs/agent_execution.log.
    Example: 2026-07-11 12:00:00 [INFO] [Supervisor] [Session: abc] Routing to SQL Agent. Details: ...
    """
    os.makedirs(LOGS_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    formatted_details = f" Details: {details}" if details else ""
    log_line = f"{timestamp} [INFO] [Agent: {agent_name}] [Session: {session_key}] {action}.{formatted_details}\n"

    with _log_lock:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(log_line)
        except Exception as e:
            print(f"[Logger Error] Failed to write log line: {str(e)}")
