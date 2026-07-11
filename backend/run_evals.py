import os
import time
import json
import re
from typing import List, Dict, Any
from langchain_core.messages import HumanMessage
from graphs.state import AgentState

# Setup environment variables from .env
from dotenv import load_dotenv
load_dotenv()

# Import agent nodes
from agents.planner import planner_node
from agents.supervisor import supervisor_node
from agents.sql_agent import sql_node
from agents.analysis_agent import analysis_node
from agents.anomaly_agent import anomaly_node
from agents.insight_agent import insight_node

LOGS_DIR = os.path.join(os.path.dirname(__file__), "logs")
EVALS_REPORT = os.path.join(LOGS_DIR, "evals_report.json")

TEST_CASES = [
    {
        "id": "TC_01",
        "name": "SQL & Visual Chart - Regional Profits",
        "query": "Show me total profit by region on a bar chart.",
        "mode": "auto",
        "expected_agents": ["sql", "chart"],
        "assertions": ["North", "West", "South", "East", "profit"]
    },
    {
        "id": "TC_02",
        "name": "Pandas Analysis - Average Unit Price",
        "query": "What is the average unit price for products sold?",
        "mode": "pandas",
        "expected_agents": ["pandas"],
        "assertions": ["unit price", "average"]
    },
    {
        "id": "TC_03",
        "name": "Anomaly Detection - Outliers Detection",
        "query": "Find all sales anomalies using isolation forest.",
        "mode": "anomaly",
        "expected_agents": ["anomaly"],
        "assertions": ["anomal", "outlier", "isolation forest"]
    }
]

def run_evaluations() -> List[Dict[str, Any]]:
    os.makedirs(LOGS_DIR, exist_ok=True)
    results = []
    
    # Try to locate a sales dataset in uploads directory
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    dataset_file = None
    if os.path.exists(uploads_dir):
        files = os.listdir(uploads_dir)
        # Look for any file containing 'sales_data.csv'
        for f in files:
            if "sales_data.csv" in f:
                dataset_file = f
                break
        if not dataset_file and files:
            dataset_file = files[0]
            
    if not dataset_file:
        dataset_file = "1_sales_data.csv" # Default fallback placeholder
        
    print(f"Using test dataset file: {dataset_file}")

    for tc in TEST_CASES:
        print(f"\n[Running {tc['id']}] {tc['name']}...")
        start_time = time.time()
        
        # Initialize state
        state = AgentState(
            messages=[HumanMessage(content=tc["query"])],
            datasets=[dataset_file],
            current_dataset=dataset_file,
            session_id=f"eval_session_{tc['id']}",
            user_id=1,
            plan=[],
            required_agents=[],
            sql_query=None,
            pandas_code=None,
            reply="",
            insights="",
            anomalies=[],
            chart_config=None,
            reasoning=""
        )
        
        sql_compile_passed = "N/A"
        pandas_compile_passed = "N/A"
        assertion_passed = "Failed"
        target_agents = []
        reply_content = ""
        error_encountered = None

        try:
            # 1. Routing step (Supervisor)
            if tc["mode"] == "auto":
                supervisor_res = supervisor_node(state)
                target_agents = supervisor_res.get("required_agents", [])
                state["required_agents"] = target_agents
            else:
                target_agents = [tc["mode"]]
                state["required_agents"] = target_agents

            # 2. Node Execution
            # Execute SQL
            if "sql" in target_agents or tc["mode"] == "sql":
                sql_res = sql_node(state)
                if "error" in sql_res:
                    sql_compile_passed = "Failed"
                    error_encountered = sql_res["error"]
                else:
                    sql_compile_passed = "Passed"
                    state["sql_query"] = sql_res.get("sql_query")
                    reply_content += "\n" + (sql_res.get("reply") or "")
            
            # Execute Pandas
            if "pandas" in target_agents or tc["mode"] == "pandas":
                pandas_res = analysis_node(state)
                if "error" in pandas_res:
                    pandas_compile_passed = "Failed"
                    error_encountered = pandas_res["error"]
                else:
                    pandas_compile_passed = "Passed"
                    state["pandas_code"] = pandas_res.get("pandas_code")
                    reply_content += "\n" + (pandas_res.get("reply") or "")
            
            # Execute Anomaly
            if "anomaly" in target_agents or tc["mode"] == "anomaly":
                anomaly_res = anomaly_node(state)
                if "error" in anomaly_res:
                    pandas_compile_passed = "Failed" # Anomaly runs pandas / python calculations
                    error_encountered = anomaly_res["error"]
                else:
                    pandas_compile_passed = "Passed"
                    reply_content += "\n" + (anomaly_res.get("insights") or "")
                    
            # Execute Insights (General final synthesis if auto mode)
            if tc["mode"] == "auto":
                insight_res = insight_node(state)
                reply_content += "\n" + (insight_res.get("reply") or "")

            # 3. Assertions Check
            passed_assertions = 0
            for term in tc["assertions"]:
                if re.search(term, reply_content, re.IGNORECASE):
                    passed_assertions += 1
            
            assertion_passed = "Passed" if passed_assertions > 0 else "Failed"
            if error_encountered:
                assertion_passed = "Failed"
                
        except Exception as e:
            error_encountered = str(e)
            assertion_passed = "Failed"
            print(f"Error running test case {tc['id']}: {str(e)}")

        elapsed = round(time.time() - start_time, 2)
        
        tc_report = {
            "id": tc["id"],
            "name": tc["name"],
            "query": tc["query"],
            "agent_mode": tc["mode"],
            "executed_agents": target_agents,
            "sql_status": sql_compile_passed,
            "code_status": pandas_compile_passed,
            "assertion_status": assertion_passed,
            "latency_seconds": elapsed,
            "error": error_encountered
        }
        results.append(tc_report)
        print(f"Finished {tc['id']} in {elapsed}s. SQL: {sql_compile_passed} | Code: {pandas_compile_passed} | Assert: {assertion_passed}")

    # Generate summary metrics
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["assertion_status"] == "Passed")
    pass_rate = round((passed_tests / total_tests) * 100, 1) if total_tests > 0 else 100.0
    avg_latency = round(sum(r["latency_seconds"] for r in results) / total_tests, 2) if total_tests > 0 else 0.0

    report_payload = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "metrics": {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "pass_rate": pass_rate,
            "avg_latency": avg_latency
        },
        "test_cases": results
    }

    with open(EVALS_REPORT, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)
        
    print(f"\nSaved evaluation report to {EVALS_REPORT}")
    return results

if __name__ == "__main__":
    run_evaluations()
