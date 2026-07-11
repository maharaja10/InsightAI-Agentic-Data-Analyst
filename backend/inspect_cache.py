from db.database import SessionLocal
from db.models import QueryCache
import json

with SessionLocal() as db:
    entries = db.query(QueryCache).all()
    print(f"Total entries in QueryCache: {len(entries)}")
    for e in entries:
        print(f"ID: {e.id}")
        print(f"Query: {e.query_text}")
        print(f"Mode: {e.agent_mode}")
        print(f"Datasets: {e.datasets_json}")
        print(f"Response (truncated): {e.response_json[:150]}")
        print("-" * 50)
