import os
import json
import re
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

router_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an Orchestration Router for an AI Data Analyst.\n"
     "Analyze the user's query and decide which of the following agents are needed to answer it. Return a JSON array of strings containing the required agent names.\n\n"
     "Available Agents:\n"
     "- pandas: For custom data manipulation, correlation matrices, summary statistics, or custom Python operations.\n"
     "- sql: For running queries, filtering, grouping, or counting records with SQL.\n"
     "- chart: For creating visual charts (bar, line, scatter, pie).\n"
     "- anomaly: For detecting statistical anomalies or outliers in data.\n"
     "- insight: For business interpretations, data summaries, or strategic recommendations.\n\n"
     "RULES:\n"
     "1. Return ONLY a valid JSON list of strings (e.g., [\"sql\", \"chart\"]).\n"
     "2. Do NOT output markdown code blocks (no ```json). Output raw JSON only.\n"
     "3. If a request is broad (e.g. 'analyze this data'), select [\"sql\", \"chart\", \"insight\"].\n"
     "4. Keep the list minimal — only include agents directly needed to address the request."),
    ("human", "{query}")
])

def route_intent(query: str) -> list[str]:
    """Classifies user intent using fast rule-based regex first, falling back to a quick LLM call if ambiguous."""
    query_lower = query.lower()
    required = set()
    
    # ── Rule-based quick checks (0ms latency) ──
    if any(k in query_lower for k in ["chart", "graph", "plot", "pie chart", "bar chart", "scatter", "visualis", "visualiz"]):
        required.add("chart")
    if any(k in query_lower for k in ["sql", "query", "database", "select "]):
        required.add("sql")
    if any(k in query_lower for k in ["anomaly", "anomalies", "outlier", "outliers", "unusual", "suspicious"]):
        required.add("anomaly")
    if any(k in query_lower for k in ["pandas", "python", "dataframe", "code", "group by"]):
        required.add("pandas")
    if any(k in query_lower for k in ["insight", "recommend", "summary", "summarise", "summarize", "overview", "analyze"]):
        required.add("insight")
        
    # If rules matched, return them immediately
    if required:
        return list(required)
        
    # ── Fallback lightweight LLM call (using openrouter/free, < 1.0s) ──
    try:
        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            model="cohere/north-mini-code:free",
            temperature=0,
            timeout=45
        )
        chain = router_prompt | llm
        resp = chain.invoke({"query": query})
        content = resp.content.strip()
        
        # Clean think blocks or markdown if present
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        start = content.find("[")
        end = content.rfind("]")
        if start != -1 and end != -1 and end >= start:
            parsed = json.loads(content[start:end+1])
            if isinstance(parsed, list):
                return parsed
    except Exception as e:
        print(f"Fallback router failed: {str(e)}")
        
    # Default fallback
    return ["sql", "chart", "insight"]
