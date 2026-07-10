"""
Direct test of anomaly_agent (bypasses uvicorn, uses fresh import)
"""
import sys
sys.path.insert(0, '.')

# Force fresh import
import importlib
import agents.anomaly_agent
importlib.reload(agents.anomaly_agent)

from agents.anomaly_agent import anomaly_node
from langchain_core.messages import HumanMessage

state = {
    "messages": [HumanMessage(content="Are there any anomalies in the sales data? Explain what they mean and which records look suspicious.")],
    "session_id": "direct_test",
    "datasets": ["sales_data.csv"],
    "current_dataset": "sales_data.csv",
}

print("Running anomaly_node directly (not via HTTP)...\n")
result = anomaly_node(state)

print("=== INSIGHTS / LLM INTERPRETATION ===")
print(result.get("insights", "(none)"))
print()
print("=== ANOMALIES DETECTED ===")
anomalies = result.get("anomalies") or []
print(f"{len(anomalies)} anomalous records found")
for i, a in enumerate(anomalies):
    print(f"  #{i+1}:", {k: v for k, v in list(a.items())[:5]})
print()
print("=== REASONING TRACE ===")
print(result.get("reasoning", ""))
print()
if "error" in result:
    print("=== ERROR ===")
    print(result["error"])
