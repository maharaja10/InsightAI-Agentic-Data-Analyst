import httpx
import time
import json
import sys

def test_caching():
    print("Testing Caching Layer...")
    url = "http://localhost:8000"
    
    # Authenticate
    client = httpx.Client()
    email = "streaming_test@example.com"
    password = "password123"
    
    resp = client.post(f"{url}/api/auth/login", data={"username": email, "password": password})
    if resp.status_code == 200:
        token = resp.json()["access_token"]
    else:
        print("Auth failed, run test_streaming.py first to register.")
        sys.exit(1)
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Run First Query (Cache Miss)
    payload_1 = {
        "message": "Calculate total profit by region from sales_data.csv and display it on a bar chart.",
        "session_id": "caching_session_v1",
        "files": ["sales_data.csv"],
        "agent_mode": "auto",
        "history": []
    }
    
    print("\n--- Running Query 1 (Expect Cache Miss / Full Graph Run) ---")
    start_time = time.time()
    has_cache_progress = False
    
    with client.stream("POST", f"{url}/api/chat/", json=payload_1, headers=headers, timeout=60.0) as r:
        if r.status_code != 200:
            print("Request 1 failed:", r.read().decode())
            return
        for line in r.iter_lines():
            if line.startswith("RAW LINE:") or not line.strip():
                continue
            if "progress" in line and "cache" in line:
                has_cache_progress = True
            if "result" in line:
                print("Result payload received.")
    elapsed_1 = time.time() - start_time
    print(f"Query 1 Finished in {elapsed_1:.2f} seconds. (Cache Progress Event triggered: {has_cache_progress})")
    
    # 2. Run Second Query (Semantic Cache Hit)
    payload_2 = {
        "message": "Calculated total profit by region from sales_data.csv showing a bar chart.", # Minor variation
        "session_id": "caching_session_v1",
        "files": ["sales_data.csv"],
        "agent_mode": "auto",
        "history": []
    }
    
    print("\n--- Running Query 2 (Expect Semantic Cache Hit / Instant Response) ---")
    start_time = time.time()
    has_cache_progress = False
    
    with client.stream("POST", f"{url}/api/chat/", json=payload_2, headers=headers, timeout=10.0) as r:
        if r.status_code != 200:
            print("Request 2 failed:", r.read().decode())
            return
        for line in r.iter_lines():
            if not line.strip():
                continue
            if "[Cache Hit]" in line:
                has_cache_progress = True
            if "result" in line:
                print("Result payload received.")
    elapsed_2 = time.time() - start_time
    print(f"Query 2 Finished in {elapsed_2:.2f} seconds. (Cache Progress Event triggered: {has_cache_progress})")
    
    # Assertions
    if has_cache_progress and elapsed_2 < 3.0:
        print("\n✅ SUCCESS: Semantic cache hit triggered correctly and returned response in < 3s!")
    else:
        print("\n❌ FAILURE: Cache hit was not triggered or query took too long.")

if __name__ == "__main__":
    test_caching()
