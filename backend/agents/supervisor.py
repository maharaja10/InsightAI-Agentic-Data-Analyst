import os
import json
from graphs.state import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    model="cohere/north-mini-code:free",
    temperature=0,
    timeout=45
)

supervisor_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are the Orchestration Supervisor for an AI Data Analyst. Your ONLY job is to determine exactly which specialized agents need to run to fulfill the user's request.\n\n"
               "Available Agents:\n"
               "- pandas: For data manipulation, dataframe cleaning, or python execution.\n"
               "- sql: For querying, joining, or explicit counting/summing operations.\n"
               "- chart: For creating visual graphs (bar, line, scatter, pie).\n"
               "- anomaly: For detecting statistical anomalies or outliers.\n"
               "- insight: For generating business insights and natural language summaries.\n\n"
               "STRICT RULES:\n"
               "1. Output ONLY a valid JSON array of strings containing the required agent names.\n"
               "2. DO NOT wrap your response in markdown code blocks (e.g., no ```json). Your output must be directly parsable by Python's json.loads().\n"
               "3. Example valid output: [\"sql\", \"chart\"]"),
    ("human", "{query}")
])

def supervisor_node(state: AgentState):
    """Dynamically routes the task to specific agents."""
    user_msg = [m for m in state["messages"] if m.type == "human"][-1].content
    try:
        chain = supervisor_prompt | llm
        response = chain.invoke({"query": user_msg})
        content = response.content.strip()
        
        # Robustly extract only the JSON array, ignoring any <think> blocks or markdown
        start_idx = content.find("[")
        end_idx = content.rfind("]")
        
        if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
            json_str = content[start_idx:end_idx+1]
            required = json.loads(json_str)
        else:
            required = []
            
        if not isinstance(required, list):
            required = ["sql", "chart", "insight"]
            
        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nSupervisor Agent: Dynamically routed task to {', '.join(required)}."
        
        from utils.logger import log_agent_action
        log_agent_action("Supervisor", state.get("session_id", "N/A"), "Routing query", f"Target agents: {required}")
        return {"required_agents": required, "reasoning": new_reasoning}
        
    except Exception as e:
        # Fallback to safe defaults if JSON parsing fails
        fallback = ["sql", "chart", "insight"]
        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nSupervisor Agent: Failed to route ({str(e)}). Fallback to {', '.join(fallback)}."
        from utils.logger import log_agent_action
        log_agent_action("Supervisor", state.get("session_id", "N/A"), "Routing error", f"Error: {str(e)}. Fallback: {fallback}")
        return {"required_agents": fallback, "reasoning": new_reasoning}
