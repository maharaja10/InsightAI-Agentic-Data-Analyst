from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: List[BaseMessage]
    session_id: str
    datasets: List[str]
    current_dataset: Optional[str]
    plan: Optional[List[str]]
    current_step: int
    sql_query: Optional[str]
    pandas_code: Optional[str]
    chart_config: Optional[Dict[str, Any]]
    insights: Optional[str]
    reasoning: Optional[str]
    anomalies: Optional[List[Dict[str, Any]]]
    required_agents: Optional[List[str]]
    error: Optional[str]
