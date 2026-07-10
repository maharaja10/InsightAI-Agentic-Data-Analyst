# v3 - with authentication + persistent sessions
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

load_dotenv()

from db.database import engine, Base
# Import models so SQLAlchemy registers them before create_all()
import db.models  # noqa: F401

from api.upload  import router as upload_router
from api.chat    import router as chat_router
from api.auth    import router as auth_router
from api.sessions import router as sessions_router
from api.dashboard import router as dashboard_router
from api.quality import router as quality_router
from api.forecast import router as forecast_router

# Create all DB tables on startup (idempotent)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="InsightAI — Agentic Data Analyst API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,     prefix="/api/auth",     tags=["auth"])
app.include_router(upload_router,   prefix="/api/upload",   tags=["upload"])
app.include_router(chat_router,     prefix="/api/chat",     tags=["chat"])
app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(quality_router,   prefix="/api/quality",   tags=["quality"])
app.include_router(forecast_router,  prefix="/api/forecast",  tags=["forecast"])

@app.get("/")
def read_root():
    return {"message": "InsightAI API is running", "version": "3.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
