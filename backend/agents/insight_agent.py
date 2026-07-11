from graphs.state import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import os
import pandas as pd
import re

insight_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert Business Analyst (like ChatGPT or Gemini). A user has asked you a question about their data.\n\n"
     "Data Preview (first 10 rows):\n{data_preview}\n\n"
     "Detected Anomalies (if any):\n{anomalies}\n\n"
     "Formulate a beautifully styled response answering the user's specific question using the data preview. Follow these formatting rules:\n"
     "1. Structure: Use standard markdown headings (###) to separate sections (e.g. ### Key Insights, ### Recommendation).\n"
     "2. Spacing: Separate paragraphs and lists with double line breaks for comfortable reading.\n"
     "3. Bullet Points: Use bold headers for list items (e.g. '- **Trend Name**: details...'). Keep points concise and highly scannable.\n"
     "4. Tone: Keep your explanation polished, executive, and direct. Avoid filler phrases like 'based on the data'. Speak like a senior analyst presenting to a director.\n"
     "5. Actionable Advice: Provide 1 concrete, actionable business recommendation based on the patterns identified."),
    ("human", "{query}")
])


def insight_node(state: AgentState):
    """Generates a conversational, question-specific business insight using LLM."""
    current_dataset = state.get("current_dataset")
    if not current_dataset:
        return state

    user_msg  = [m for m in state["messages"] if m.type == "human"][-1].content
    file_path = os.path.join("uploads", current_dataset)

    try:
        df           = pd.read_csv(file_path)
        data_preview = df.head(10).to_csv(index=False)
        anomalies_str = str(state.get("anomalies", []))

        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            model="cohere/north-mini-code:free",
            temperature=0,
            timeout=45,
            streaming=True
        )

        chain    = insight_prompt | llm
        response = chain.invoke({
            "data_preview": data_preview,
            "anomalies":    anomalies_str,
            "query":        user_msg,
        })

        content = re.sub(r"<think>.*?</think>", "", response.content, flags=re.DOTALL).strip()

        # Fallback if empty
        if not content:
            content = (
                "I've analysed your dataset. The data shows interesting patterns across the "
                "key metrics. Please check the data preview and let me know if you'd like a "
                "deeper analysis on any specific aspect."
            )

        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nInsight Agent: Generated conversational business insights."

        from utils.logger import log_agent_action
        log_agent_action("Insight Agent", state.get("session_id", "N/A"), "Generated insights", f"Preview data length: {len(data_preview)} chars")
        return {
            "insights":  content,
            "reply":     content,
            "reasoning": new_reasoning,
        }

    except Exception as e:
        current_reasoning = state.get("reasoning", "")
        from utils.logger import log_agent_action
        log_agent_action("Insight Agent", state.get("session_id", "N/A"), "Insight analysis error", str(e))
        return {
            "reasoning": f"{current_reasoning}\n\nInsight Agent: Failed ({str(e)}).",
            "insights":  f"I couldn't generate insights due to an error: {str(e)}",
        }
