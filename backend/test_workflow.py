import sys
import os
import json
from dotenv import load_dotenv

# Ensure the root of the backend is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from graphs.workflow import app
from langchain_core.messages import HumanMessage

def test_workflow():
    print("Testing LangGraph Workflow orchestration...")
    
    state = {
        "messages": [
            HumanMessage(content="Calculate the total profit by region from sales_data.csv and display it on a bar chart.")
        ],
        "session_id": "test_workflow_session",
        "datasets": ["sales_data.csv"],
        "current_dataset": "sales_data.csv",
        "plan": [],
        "current_step": 0,
        "sql_query": None,
        "pandas_code": None,
        "chart_config": None,
        "insights": None,
        "reasoning": "",
        "anomalies": None,
        "required_agents": []
    }
    
    try:
        final_state = app.invoke(state)
        print("\n--- FINAL WORKFLOW STATE ---")
        print("Plan generated:", final_state.get("plan"))
        print("Required agents routed:", final_state.get("required_agents"))
        print("SQL query generated:", final_state.get("sql_query"))
        print("Pandas code generated:", final_state.get("pandas_code"))
        print("Chart config keys:", list(final_state.get("chart_config").keys()) if final_state.get("chart_config") else None)
        print("Reply message preview:", final_state.get("reply")[:300] if final_state.get("reply") else None)
        print("\n--- REASONING TRACE ---")
        print(final_state.get("reasoning"))
        print("\nWorkflow Execution completed successfully!")
    except Exception as e:
        print(f"\nExecution failed with error: {str(e)}")

if __name__ == "__main__":
    test_workflow()
