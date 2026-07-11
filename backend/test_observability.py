import httpx
import sys

def test_observability():
    print("Testing Observability Logging...")
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
    
    # 1. Fetch system logs
    print("\nFetching system logs from API endpoint...")
    log_resp = client.get(f"{url}/api/dashboard/logs/", headers=headers)
    if log_resp.status_code == 200:
        logs = log_resp.json()
        print(f"Retrieved {len(logs)} log entries:")
        for log in logs[-5:]:
            print("LOG:", log)
            
        # Assertions
        if len(logs) > 0:
            print("\n✅ SUCCESS: Observability log entries fetched successfully!")
        else:
            print("\n⚠️  WARNING: Log file is empty or does not exist yet (requires running a query).")
    else:
        print("\n❌ FAILURE: Failed to fetch system logs:", log_resp.status_code, log_resp.text)

if __name__ == "__main__":
    test_observability()
