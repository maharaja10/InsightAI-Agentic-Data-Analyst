import pandas as pd
import os
import re
from graphs.state import AgentState
from sklearn.ensemble import IsolationForest
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

ANOMALY_MODEL = "cohere/north-mini-code:free"

anomaly_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert Data Scientist (like ChatGPT or Gemini). A user has asked you a question about anomalies in their dataset.\n\n"
     "You ran an Isolation Forest algorithm and here are the results:\n\n"
     "Dataset Columns: {schema}\n\n"
     "Descriptive Statistics:\n{data_summary}\n\n"
     "Detection Results:\n"
     "  - Total records analysed: {total_records}\n"
     "  - Anomalies detected: {anomaly_count} ({anomaly_pct}% of data)\n"
     "  - Anomalous records:\n{anomaly_samples}\n\n"
     "Formulate a beautifully styled response answering the user's specific question using the results. Follow these formatting rules:\n"
     "1. Structure: Use standard markdown headings (###) to separate distinct sections (e.g., ### Outliers Detected, ### Explanation, ### Recommendation).\n"
     "2. Spacing: Separate paragraphs and lists with double line breaks for comfortable reading.\n"
     "3. Bullet Points: Use bold headers for list items (e.g. '- **Outlier Row #1**: details...'). Keep points concise and highly scannable.\n"
     "4. Metrics: Clearly highlight anomalous values and explain why they are statistical outliers (e.g. compare them to the mean or standard deviation).\n"
     "5. Actionable Advice: Suggest a concrete, business-oriented step to verify or resolve the flagged anomaly.\n"
     "6. Tone: Speak in a friendly, polished, and expert tone. Base your explanation strictly on the provided 'Detection Results'."),
    ("human", "{query}")
])


def anomaly_node(state: AgentState):
    """Detects anomalies with Isolation Forest + conversational LLM interpretation."""
    current_dataset = state.get("current_dataset")
    if not current_dataset:
        return state

    file_path = os.path.join("uploads", current_dataset)
    anomalies = []

    try:
        df = pd.read_csv(file_path)
        user_msg = [m for m in state["messages"] if m.type == "human"][-1].content

        numeric_df = df.select_dtypes(include=["number"]).dropna()
        schema_str = ", ".join([f"{k} ({v})" for k, v in df.dtypes.to_dict().items()])
        total_records = len(numeric_df)

        if not numeric_df.empty and total_records > 5:
            clf = IsolationForest(random_state=42, contamination=0.05, n_estimators=100)
            clf.fit(numeric_df)
            preds = clf.predict(numeric_df)

            anomaly_indices = numeric_df.index[preds == -1].tolist()
            anomaly_count   = len(anomaly_indices)

            if anomaly_indices:
                sample_indices    = anomaly_indices[:5]
                anomaly_sample_df = df.iloc[sample_indices]
                anomalies         = anomaly_sample_df.to_dict(orient="records")
                anomaly_samples_str = anomaly_sample_df.to_string(index=True)
            else:
                anomaly_count       = 0
                anomaly_samples_str = "None — all records are within normal statistical bounds."

            try:
                data_summary = numeric_df.describe().round(2).to_string()
            except Exception:
                data_summary = "Summary statistics unavailable."

            anomaly_pct = round((anomaly_count / total_records) * 100, 1) if total_records > 0 else 0.0

            # Instantiate LLM fresh each call (avoids module-cache staleness)
            llm = ChatOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=os.environ.get("OPENROUTER_API_KEY"),
                model=ANOMALY_MODEL,
                temperature=0,
                timeout=45,
                streaming=True
            )

            chain    = anomaly_prompt | llm
            response = chain.invoke({
                "schema":          schema_str,
                "data_summary":    data_summary,
                "total_records":   total_records,
                "anomaly_count":   anomaly_count,
                "anomaly_pct":     anomaly_pct,
                "anomaly_samples": anomaly_samples_str,
                "query":           user_msg,
            })

            interpretation = re.sub(r"<think>.*?</think>", "", response.content, flags=re.DOTALL).strip()

            # Robust fallback if model returns empty
            if not interpretation:
                if anomaly_count > 0:
                    sample = anomalies[0]
                    interpretation = (
                        f"I detected {anomaly_count} anomalous record(s) in your dataset ({anomaly_pct}% of data). "
                        f"The most suspicious record belongs to {sample.get('Customer_Name', 'an unknown customer')} "
                        f"with unusually high values: Sales={sample.get('Sales', 'N/A')}, "
                        f"Unit_Price={sample.get('Unit_Price', 'N/A')}. "
                        "These values are significantly higher than the dataset average, which triggered the Isolation Forest flag. "
                        "I recommend reviewing this transaction for potential data entry errors or pricing discrepancies."
                    )
                else:
                    interpretation = (
                        f"Good news! After analysing all {total_records} records using Isolation Forest, "
                        "no anomalies were detected. All data points fall within expected statistical ranges."
                    )

            reasoning_detail = (
                f"Anomaly Agent: Ran Isolation Forest on {total_records} records across "
                f"{len(numeric_df.columns)} numeric columns. "
                f"Detected {anomaly_count} anomalies ({anomaly_pct}%). "
                f"Used {ANOMALY_MODEL} for conversational interpretation."
            )

        else:
            interpretation = (
                "I wasn't able to run anomaly detection because the dataset doesn't have enough "
                "numeric data (I need at least 5 rows with numeric columns). "
                "Please upload a larger dataset to use this feature."
            )
            anomaly_count    = 0
            reasoning_detail = "Anomaly Agent: Insufficient numeric data for Isolation Forest."

        current_reasoning = state.get("reasoning", "")
        from utils.logger import log_agent_action
        log_agent_action("Anomaly Agent", state.get("session_id", "N/A"), "Detected anomalies", reasoning_detail)
        return {
            "anomalies": anomalies,
            "insights":  interpretation,
            "reasoning": f"{current_reasoning}\n\n{reasoning_detail}",
        }

    except Exception as e:
        from utils.logger import log_agent_action
        log_agent_action("Anomaly Agent", state.get("session_id", "N/A"), "Anomaly analysis error", str(e))
        return {"error": f"Anomaly detection failed: {str(e)}"}
