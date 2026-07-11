import httpx
import sys

def test_schema_search():
    print("Testing Dataset Schema Search...")
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
    
    # Search for "profit"
    search_term = "profit"
    print(f"\nSearching schemas for term: '{search_term}'...")
    
    resp = client.post(f"{url}/api/upload/search", json={"query": search_term}, headers=headers)
    if resp.status_code == 200:
        results = resp.json()
        print(f"Found {len(results)} matching columns:\n")
        for match in results:
            print(f"- Column: {match['column']} ({match['type']})")
            print(f"  File:   {match['filename']}")
            print(f"  Score:  {match['score']}")
            print(f"  Sample: {match['sample']}")
            print()
            
        # Assertions
        if len(results) > 0 and results[0]['column'].lower() == 'profit':
            print("✅ SUCCESS: Found column 'Profit' at the top rank!")
        else:
            print("❌ FAILURE: Column rankings are incorrect or empty.")
    else:
        print("Request failed:", resp.status_code, resp.text)

if __name__ == "__main__":
    test_schema_search()
