import subprocess
import time
import httpx
import sys

print("Starting diagnostic server on port 8055...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--port", "8055"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

time.sleep(3) # Wait for server to start

try:
    client = httpx.Client()
    # Let's hit the root endpoint first
    r_root = client.get("http://localhost:8055/")
    print("Root response:", r_root.status_code, r_root.json())
    
    # Let's list the routes or hit stats/logs (without auth first to see if it returns 401 or 404)
    r_stats = client.get("http://localhost:8055/api/dashboard/stats/")
    print("Stats response (no auth):", r_stats.status_code, r_stats.text)
    
    r_logs = client.get("http://localhost:8055/api/dashboard/logs/")
    print("Logs response (no auth):", r_logs.status_code, r_logs.text)
    
finally:
    proc.terminate()
    proc.wait()
