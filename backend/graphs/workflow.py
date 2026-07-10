from langgraph.graph import StateGraph, START, END
from graphs.state import AgentState
from agents.planner import planner_node
from agents.dataset_agent import dataset_node
from agents.supervisor import supervisor_node
from agents.analysis_agent import analysis_node
from agents.sql_agent import sql_node
from agents.chart_agent import chart_node
from agents.anomaly_agent import anomaly_node
from agents.insight_agent import insight_node
from agents.reasoning_agent import reasoning_node

def route_after_planner(state: AgentState):
    if state.get("error"):
        return END
    return "dataset"

def route_after_supervisor(state: AgentState):
    req = state.get("required_agents") or []
    if "pandas" in req: return "analysis"
    if "sql" in req: return "sql"
    if "chart" in req: return "chart"
    if "anomaly" in req: return "anomaly"
    if "insight" in req: return "insight"
    return "reasoning_agent"

def route_after_analysis(state: AgentState):
    req = state.get("required_agents") or []
    if "sql" in req: return "sql"
    if "chart" in req: return "chart"
    if "anomaly" in req: return "anomaly"
    if "insight" in req: return "insight"
    return "reasoning_agent"

def route_after_sql(state: AgentState):
    req = state.get("required_agents") or []
    if "chart" in req: return "chart"
    if "anomaly" in req: return "anomaly"
    if "insight" in req: return "insight"
    return "reasoning_agent"

def route_after_chart(state: AgentState):
    req = state.get("required_agents") or []
    if "anomaly" in req: return "anomaly"
    if "insight" in req: return "insight"
    return "reasoning_agent"

def route_after_anomaly(state: AgentState):
    req = state.get("required_agents") or []
    if "insight" in req: return "insight"
    return "reasoning_agent"

def build_workflow():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("planner", planner_node)
    workflow.add_node("dataset", dataset_node)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("analysis", analysis_node)
    workflow.add_node("sql", sql_node)
    workflow.add_node("chart", chart_node)
    workflow.add_node("anomaly", anomaly_node)
    workflow.add_node("insight", insight_node)
    workflow.add_node("reasoning_agent", reasoning_node)
    
    # Add edges
    workflow.add_edge(START, "planner")
    
    workflow.add_conditional_edges(
        "planner",
        route_after_planner,
        {"dataset": "dataset", END: END}
    )
    
    workflow.add_edge("dataset", "supervisor")
    
    route_map = {
        "analysis": "analysis",
        "sql": "sql",
        "chart": "chart",
        "anomaly": "anomaly",
        "insight": "insight",
        "reasoning_agent": "reasoning_agent"
    }
    
    workflow.add_conditional_edges("supervisor", route_after_supervisor, route_map)
    workflow.add_conditional_edges("analysis", route_after_analysis, route_map)
    workflow.add_conditional_edges("sql", route_after_sql, route_map)
    workflow.add_conditional_edges("chart", route_after_chart, route_map)
    workflow.add_conditional_edges("anomaly", route_after_anomaly, route_map)
    workflow.add_edge("insight", "reasoning_agent")
    workflow.add_edge("reasoning_agent", END)
    
    return workflow.compile()

app = build_workflow()
