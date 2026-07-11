import httpx

url = "http://localhost:8000"
client = httpx.Client()
email = "streaming_test@example.com"
password = "password123"

resp = client.post(f"{url}/api/auth/login", data={"username": email, "password": password})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("Testing stats endpoint...")
r_stats = client.get(f"{url}/api/dashboard/stats/", headers=headers)
print("Stats response:", r_stats.status_code)

print("Testing logs endpoint with slash...")
r_logs1 = client.get(f"{url}/api/dashboard/logs/", headers=headers)
print("Logs response:", r_logs1.status_code, r_logs1.text[:100])

print("Testing logs endpoint without slash...")
r_logs2 = client.get(f"{url}/api/dashboard/logs", headers=headers)
print("Logs response (no slash):", r_logs2.status_code)
