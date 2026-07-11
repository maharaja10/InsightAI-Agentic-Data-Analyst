"""
Chat API — protected endpoint that processes user messages through the AI agents
and persists the full Q&A exchange in the ChatMessages table.
"""
import json
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from api.auth import get_current_user
from api.sessions import upsert_session, UpsertSessionRequest
from db.database import get_db
from db.models import User, ChatSession, ChatMessage

router = APIRouter()


def check_cache(user_id: int, agent_mode: str, active_files: List[str], query_text: str, db: Session) -> Optional[dict]:
    from db.models import QueryCache
    import json
    
    # Sort files to ensure order-independent list matching
    sorted_files = sorted(active_files)
    
    # Find all cache entries for this user, mode
    entries = db.query(QueryCache).filter(
        QueryCache.user_id == user_id,
        QueryCache.agent_mode == agent_mode
    ).all()
    
    if not entries:
        return None
        
    # Filter entries by the exact list of files
    matching_entries = []
    for entry in entries:
        try:
            entry_files = json.loads(entry.datasets_json)
            if sorted(entry_files) == sorted_files:
                matching_entries.append(entry)
        except Exception:
            continue
            
    if not matching_entries:
        return None
        
    # 1. Exact Match Check (case-insensitive, whitespace stripped)
    target_query = query_text.strip().lower()
    for entry in matching_entries:
        if entry.query_text.strip().lower() == target_query:
            try:
                return json.loads(entry.response_json)
            except Exception:
                continue
            
    # 2. Semantic Match Check via Scikit-Learn TF-IDF Cosine Similarity
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        cached_queries = [entry.query_text for entry in matching_entries]
        all_texts = cached_queries + [query_text]
        
        # Use character-level w/word-boundary ngrams for robust semantic/lexical overlap
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        
        # Compute cosine similarity between the last document (our query) and all previous ones
        similarities = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])[0]
        
        best_idx = similarities.argmax()
        best_score = similarities[best_idx]
        
        if best_score >= 0.92:
            print(f"[Cache] Semantic cache hit! Score: {best_score:.4f} for cached query: '{cached_queries[best_idx]}'")
            return json.loads(matching_entries[best_idx].response_json)
    except Exception as e:
        print("[Cache] Error computing semantic similarity:", str(e))
        
    return None


def save_cache(user_id: int, agent_mode: str, active_files: List[str], query_text: str, response_payload: dict, db: Session):
    from db.models import QueryCache
    import json
    try:
        # Avoid duplicate queries
        existing = db.query(QueryCache).filter(
            QueryCache.user_id == user_id,
            QueryCache.agent_mode == agent_mode,
            QueryCache.query_text == query_text
        ).first()
        if existing:
            return
            
        cache_entry = QueryCache(
            user_id=user_id,
            query_text=query_text,
            agent_mode=agent_mode,
            datasets_json=json.dumps(active_files),
            response_json=json.dumps(response_payload)
        )
        db.add(cache_entry)
        db.commit()
    except Exception as e:
        print("[Cache] Error saving cache entry:", str(e))


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
@router.post("/")
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
    db_session_id = db_session.id

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

    current_user_id = current_user.id

    # Build agent state
    state = {
        "messages":       [HumanMessage(content=final_message)],
        "session_id":     request.session_id,
        "datasets":       datasets_list,
        "current_dataset": file_path,
    }

    # ── 5. Cache Check ───────────────────────────────────────────────────────
    cached_resp = check_cache(
        user_id=current_user_id,
        agent_mode=request.agent_mode or "auto",
        active_files=active_files,
        query_text=request.message,
        db=db
    )
    
    if cached_resp:
        # Persist cached AI response in session history immediately
        save_message(request.session_id, "ai", cached_resp["message"])
        extras = {
            k: v for k, v in {
                "chart":     cached_resp.get("chart"),
                "sql":       cached_resp.get("sql"),
                "code":      cached_resp.get("code"),
                "insights":  cached_resp.get("insights"),
                "anomalies": cached_resp.get("anomalies"),
            }.items() if v
        }
        _save_message(db_session, "ai", cached_resp["message"], request.agent_mode or "auto", extras, db)

        async def cached_event_generator():
            yield "event: progress\ndata: " + json.dumps({"step": "cache", "message": "[Cache Hit] Retrieving saved response..."}) + "\n\n"
            await asyncio.sleep(0.1)
            msg_text = cached_resp.get("message") or "Analysis complete."
            
            # Stream the cached text in chunks to simulate real-time typing
            for chunk in [msg_text[i:i+4] for i in range(0, len(msg_text), 4)]:
                yield "event: token\ndata: " + json.dumps({"text": chunk}) + "\n\n"
                await asyncio.sleep(0.005)
                
            yield "event: result\ndata: " + json.dumps(cached_resp) + "\n\n"

        return StreamingResponse(cached_event_generator(), media_type="text/event-stream")

    async def event_generator():
        mode = request.agent_mode
        final_text = ""
        final_chart = None
        final_sql = None
        final_code = None
        final_insights = None
        final_reasoning = ""
        final_anomalies = None

        try:
            if mode == "sql":
                yield "event: progress\ndata: " + json.dumps({"step": "sql", "message": "SQL Agent: Formulating and executing query..."}) + "\n\n"
                await asyncio.sleep(0.1)
                from agents.sql_agent import sql_node
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, sql_node, state)
                if "error" in result:
                    raise Exception(result["error"])
                final_text = result.get("reply") or ""
                final_sql = result.get("sql_query")
                final_reasoning = result.get("reasoning", "")

            elif mode == "pandas":
                yield "event: progress\ndata: " + json.dumps({"step": "analysis", "message": "Pandas Agent: Compiling and running code..."}) + "\n\n"
                await asyncio.sleep(0.1)
                from agents.analysis_agent import analysis_node
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, analysis_node, state)
                if "error" in result:
                    raise Exception(result["error"])
                final_text = result.get("reply") or ""
                final_code = result.get("pandas_code")
                final_insights = result.get("insights")
                final_reasoning = result.get("reasoning", "")

            elif mode == "graph":
                yield "event: progress\ndata: " + json.dumps({"step": "chart", "message": "Graph Agent: Rendering Plotly visualization..."}) + "\n\n"
                await asyncio.sleep(0.1)
                from agents.chart_agent import chart_node
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, chart_node, state)
                if "error" in result:
                    raise Exception(result["error"])
                final_text = result.get("reply") or "Visualization generated."
                final_chart = result.get("chart_config")
                final_reasoning = result.get("reasoning", "")

            elif mode == "anomaly":
                yield "event: progress\ndata: " + json.dumps({"step": "anomaly", "message": "Anomaly Agent: Inspecting Isolation Forest outliers..."}) + "\n\n"
                await asyncio.sleep(0.1)
                from agents.anomaly_agent import anomaly_node
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, anomaly_node, state)
                if "error" in result:
                    raise Exception(result["error"])
                final_text = result.get("reply") or result.get("insights") or ""
                final_anomalies = result.get("anomalies")
                final_insights = result.get("insights")
                final_reasoning = result.get("reasoning", "")

            elif mode == "insights":
                yield "event: progress\ndata: " + json.dumps({"step": "insight", "message": "Insights Agent: Generating business analysis summary..."}) + "\n\n"
                await asyncio.sleep(0.1)
                from agents.insight_agent import insight_node
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, insight_node, state)
                if "error" in result:
                    raise Exception(result["error"])
                final_text = result.get("reply") or result.get("insights") or ""
                final_insights = result.get("insights")
                final_reasoning = result.get("reasoning", "")

            else:  # auto mode - full LangGraph event streaming
                from graphs.workflow import app
                async for event in app.astream_events(state, version="v2"):
                    kind = event.get("event")
                    name = event.get("name")
                    
                    # 1. Track Node transitions (on_chain_start/on_chain_end for node functions)
                    if kind == "on_chain_start" and name in [
                        "planner", "dataset", "supervisor", "analysis", "sql", "chart", "anomaly", "insight", "reasoning_agent"
                    ]:
                        display_msgs = {
                            "planner": "Execution Planner: Drafting step-by-step query plan...",
                            "dataset": "Dataset Loader: Verifying schema structures...",
                            "supervisor": "Supervisor Router: Analyzing planning steps and routing...",
                            "analysis": "Pandas Agent: Writing and running database code...",
                            "sql": "SQL Agent: Formulating and executing SQL queries...",
                            "chart": "Graph Agent: Creating Plotly visualization config...",
                            "anomaly": "Anomaly Agent: Analyzing Isolation Forest outliers...",
                            "insight": "Insights Agent: Drafting conversational summary...",
                            "reasoning_agent": "Reasoning Tracer: Finalizing execution path audit..."
                        }
                        msg = display_msgs.get(name, f"Running {name}...")
                        yield "event: progress\ndata: " + json.dumps({"step": name, "message": msg}) + "\n\n"
                        
                    # 2. Track chat model streaming tokens
                    elif kind == "on_chat_model_stream":
                        content = event.get("data", {}).get("chunk", {}).content
                        if content:
                            yield "event: token\ndata: " + json.dumps({"text": content}) + "\n\n"
                            
                    # 3. Capture final state values once chains finish
                    elif kind == "on_chain_end" and name == "LangGraph":
                        outputs = event.get("data", {}).get("output", {})
                        if outputs:
                            if outputs.get("error"):
                                raise Exception(outputs["error"])
                            final_text = outputs.get("reply") or outputs.get("insights") or "Analysis complete."
                            final_chart = outputs.get("chart_config")
                            final_sql = outputs.get("sql_query")
                            final_code = outputs.get("pandas_code")
                            final_insights = outputs.get("insights")
                            final_reasoning = outputs.get("reasoning", "Orchestrated agentic workflow.")
                            final_anomalies = outputs.get("anomalies")

            if final_text and not request.agent_mode == "auto":
                # Yield tokens incrementally for standard synchronous fallback nodes
                for chunk in [final_text[i:i+4] for i in range(0, len(final_text), 4)]:
                    yield "event: token\ndata: " + json.dumps({"text": chunk}) + "\n\n"
                    await asyncio.sleep(0.01)

            # Yield final consolidated payload
            result_payload = {
                "message": final_text or "Analysis complete.",
                "chart": final_chart,
                "sql": final_sql,
                "code": final_code,
                "insights": final_insights,
                "reasoning": final_reasoning,
                "anomalies": final_anomalies,
            }
            yield "event: result\ndata: " + json.dumps(result_payload) + "\n\n"

            # Persist response in background DB
            from db.database import SessionLocal
            with SessionLocal() as local_db:
                from db.models import ChatSession
                db_sess = local_db.query(ChatSession).filter(ChatSession.id == db_session_id).first()
                if db_sess:
                    save_message(request.session_id, "ai", result_payload["message"])
                    extras = {
                        k: v for k, v in {
                            "chart":     result_payload["chart"],
                            "sql":       result_payload["sql"],
                            "code":      result_payload["code"],
                            "insights":  result_payload["insights"],
                            "anomalies": result_payload["anomalies"],
                        }.items() if v
                    }
                    _save_message(db_sess, "ai", result_payload["message"], mode or "auto", extras, local_db)
                
                # Save in QueryCache
                save_cache(
                    user_id=current_user_id,
                    agent_mode=mode or "auto",
                    active_files=active_files,
                    query_text=request.message,
                    response_payload=result_payload,
                    db=local_db
                )

        except Exception as e:
            err_msg = f"I encountered an error while processing your request: {str(e)}"
            yield "event: error\ndata: " + json.dumps({"message": err_msg, "reasoning": str(e)}) + "\n\n"
            
            from db.database import SessionLocal
            with SessionLocal() as local_db:
                from db.models import ChatSession
                db_sess = local_db.query(ChatSession).filter(ChatSession.id == db_session_id).first()
                if db_sess:
                    save_message(request.session_id, "ai", err_msg)
                    _save_message(db_sess, "ai", err_msg, mode or "auto", {"reasoning": str(e)}, local_db)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
