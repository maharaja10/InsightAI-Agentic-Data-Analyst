import httpx
import json
import sys

def test_streaming():
    print("Testing Streaming Response API (SSE)...")
    url = "http://localhost:8000"
    
    # Step 1: Register/Login to get JWT token
    client = httpx.Client()
    email = "streaming_test@example.com"
    password = "password123"
    
    print("Attempting to login...")
    try:
        # Try login first
        resp = client.post(f"{url}/api/auth/login", data={"username": email, "password": password})
        if resp.status_code == 200:
            token = resp.json()["access_token"]
            print("Logged in successfully.")
        else:
            # Register new user
            print("User not found, registering...")
            reg_resp = client.post(f"{url}/api/auth/register", json={
                "email": email,
                "password": password,
                "display_name": "Stream Tester"
            })
            if reg_resp.status_code == 201:
                token = reg_resp.json()["access_token"]
                print("Registered and authenticated successfully.")
            else:
                print("Registration failed:", reg_resp.text)
                sys.exit(1)
    except Exception as e:
        print("Auth error (make sure uvicorn is running on port 8000):", str(e))
        sys.exit(1)
        
    # Step 2: Send query and stream response
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "message": "Calculate the total profit by region from sales_data.csv and display it on a bar chart.",
        "session_id": "streaming_session_v1",
        "files": ["sales_data.csv"],
        "agent_mode": "auto",
        "history": []
    }
    
    print("\nSending stream query payload...")
    try:
        with client.stream("POST", f"{url}/api/chat/", json=payload, headers=headers, timeout=60.0) as r:
            if r.status_code != 200:
                print("Stream request failed with status:", r.status_code)
                print(r.read().decode())
                return
                
            print("Stream established. Reading chunks...\n")
            for line in r.iter_lines():
                if not line.strip():
                    continue
                print("RAW LINE:", line)
    except Exception as e:
        print("\nStreaming failed with error:", str(e))

if __name__ == "__main__":
    test_streaming()
