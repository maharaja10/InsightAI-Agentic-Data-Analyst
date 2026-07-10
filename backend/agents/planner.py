from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
import os
from graphs.state import AgentState

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    model="cohere/north-mini-code:free",
    temperature=0
)

planner_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert AI Execution Planner. Your ONLY job is to create a clear, step-by-step execution plan to answer the user's query.\n\n"
               "Context:\n"
               "- Available datasets: {datasets}\n\n"
               "STRICT RULES:\n"
               "1. Output ONLY a numbered list of concrete steps. No conversational filler.\n"
               "2. Keep the steps concise and technically actionable.\n"
               "3. Example valid output:\n1. Load dataset\n2. Group by region and sum revenue\n3. Generate bar chart"),
    ("human", "{query}")
])

import re

def planner_node(state: AgentState):
    """Generates an execution plan based on the user's query."""
    user_msg = [m for m in state["messages"] if m.type == "human"][-1]
    
    chain = planner_prompt | llm
    
    # We use a mocked plan for now if no datasets, or invoke the LLM
    datasets = state.get("datasets", [])
    if not datasets:
        return {"plan": ["1. Request dataset upload"], "reasoning": "No datasets available to process the request."}
        
    try:
        response = chain.invoke({"query": user_msg.content, "datasets": ", ".join(datasets)})
        
        # Robustly extract only numbered steps, ignoring <think> blocks or filler
        plan_steps = []
        for line in response.content.split('\n'):
            line = line.strip()
            # Only append lines that start with a number followed by a dot (e.g., "1. Load data")
            if re.match(r"^\d+\.", line):
                plan_steps.append(line)
                
        reasoning = f"Created a {len(plan_steps)}-step execution plan to analyze the query."
        return {"plan": plan_steps, "reasoning": reasoning}
    except Exception as e:
        return {"error": str(e)}
