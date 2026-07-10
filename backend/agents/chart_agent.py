import pandas as pd
import os
import json
import re
from graphs.state import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    model="cohere/north-mini-code:free",
    temperature=0
)

chart_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an expert Data Visualization Engineer. Generate exactly ONE clean, professional, and syntax-correct Plotly.js chart configuration.\n\n"
     "Data Preview (CSV, first 5 rows):\n{data_preview}\n\n"
     "Column Types:\n{column_summary}\n\n"
     "RULES - follow every rule or the output is invalid:\n"
     "1. Output ONLY a valid JSON object. Do NOT wrap in markdown blocks (no ```json), no explanations, and no code comments. Just raw, parsable JSON.\n"
     "2. Double check JSON syntax: Avoid trailing commas, ensure balanced braces/brackets, and escape double quotes inside strings.\n"
     "3. The JSON must have exactly two top-level keys: `data` (array) and `layout` (object).\n"
     "4. The `data` array must contain EXACTLY ONE trace object. Never combine different chart types in the trace list.\n"
     "   - Use `bar` for categorical comparisons\n"
     "   - Use `line` for time-series trends\n"
     "   - Use `scatter` for correlation / numeric plots\n"
     "   - Use `pie` (donut) for proportions (set `hole`: 0.4 inside the trace)\n"
     "5. Limit data size: Aggregate or truncate data points to at most 10 groups/categories before charting (e.g. top 10 products by profit).\n"
     "6. For bar/scatter/line, set marker colors using this exact color array:\n"
     "   [\"#818cf8\",\"#a78bfa\",\"#f472b6\",\"#34d399\",\"#fbbf24\",\"#60a5fa\",\"#f87171\",\"#fb923c\",\"#4ade80\",\"#38bdf8\"]\n"
     "7. The layout configuration MUST include these aesthetic parameters:\n"
     "   - title: {{\"text\": \"<descriptive title>\", \"font\": {{\"size\": 17, \"color\": \"#e2e8f0\", \"family\": \"Inter, Roboto, sans-serif\"}}, \"x\": 0.05}}\n"
     "   - paper_bgcolor: \"rgba(0,0,0,0)\"\n"
     "   - plot_bgcolor: \"rgba(0,0,0,0)\"\n"
     "   - font: {{\"family\": \"Inter, Roboto, sans-serif\", \"color\": \"#94a3b8\", \"size\": 12}}\n"
     "   - margin: {{\"t\": 70, \"r\": 40, \"b\": 90, \"l\": 80, \"pad\": 4}}\n"
     "   - legend: {{\"bgcolor\": \"rgba(30,41,59,0.8)\", \"bordercolor\": \"rgba(148,163,184,0.2)\", \"borderwidth\": 1, \"font\": {{\"color\": \"#cbd5e1\", \"size\": 11}}}}\n"
     "   - For bar/line/scatter: include `xaxis` and `yaxis` configurations with: gridcolor: \"rgba(148,163,184,0.08)\", linecolor: \"rgba(148,163,184,0.2)\", tickfont: {{\"color\": \"#94a3b8\", \"size\": 11}}, title: {{\"font\": {{\"color\": \"#cbd5e1\"}}}}, automargin: true, zeroline: false\n"
     "   - For bar charts: set `bargap`: 0.25 in the layout."),
    ("human", "{query}")
])


def chart_node(state: AgentState):
    """Determines chart type and generates a clean Plotly config using LLM."""
    current_dataset = state.get("current_dataset")
    if not current_dataset:
        return state

    user_msg = [m for m in state["messages"] if m.type == "human"][-1].content
    file_path = os.path.join("uploads", current_dataset)

    try:
        df = pd.read_csv(file_path)
        data_preview = df.head(5).to_csv(index=False)
        col_types = df.dtypes.to_dict()
        col_summary = ", ".join([f"{k} ({v})" for k, v in col_types.items()])

        chain = chart_prompt | llm
        response = chain.invoke({
            "data_preview": data_preview,
            "column_summary": col_summary,
            "query": user_msg,
        })
        json_str = response.content.strip()

        # Robustly extract JSON block
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", json_str, re.DOTALL | re.IGNORECASE)
        if match:
            json_str = match.group(1).strip()
        else:
            # Strip any <think>...</think> blocks
            json_str = re.sub(r"<think>.*?</think>", "", json_str, flags=re.DOTALL).strip()
            # Extract outermost { ... }
            start_idx = json_str.find("{")
            end_idx = json_str.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
                json_str = json_str[start_idx:end_idx + 1]

        chart_config = json.loads(json_str)

        # Safety net: keep only one trace to avoid overlapping chart types
        if "data" in chart_config and isinstance(chart_config["data"], list) and len(chart_config["data"]) > 1:
            non_scatter = [t for t in chart_config["data"] if t.get("type") not in ("scatter", "scattergl")]
            chart_config["data"] = [non_scatter[0]] if non_scatter else [chart_config["data"][0]]

        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nVisualization Agent: Generated a clean Plotly configuration based on data structure."

        return {"chart_config": chart_config, "reasoning": new_reasoning}

    except Exception as e:
        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nVisualization Agent: Failed to generate chart ({str(e)})."
        return {"reasoning": new_reasoning}
