import duckdb
import os
import re
import pandas as pd
from graphs.state import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# ── SQL generation prompt ──────────────────────────────────────────────────────
sql_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a senior SQL Database Administrator. Write a highly optimized SQL query to answer the user's request.\n\n"
     "Target Database: DuckDB. The database contains multiple tables. Join them when necessary.\n"
     "Available Tables and Schemas:\n{schema}\n\n"
     "RULES:\n"
     "1. Write ONLY a valid SELECT statement. Use correct column names from the schema. DO NOT select columns not listed in the schema.\n"
     "2. Case-Insensitive String Matches: For text filters based on user queries, always use LOWER(column) = LOWER('value') or columns ILIKE 'value' (e.g. `Payment_Mode ILIKE 'credit card'`) to prevent empty queries from capitalization mismatches.\n"
     "3. Date Handling: Use correct DuckDB date operations (e.g., `EXTRACT(YEAR FROM Order_Date)` or standard date casts if matching dates).\n"
     "4. Output ONLY the raw SQL query string. Do NOT write markdown blocks (no ```sql), no comments, and no explanations.\n"
     "5. Avoid database modifications (no INSERT, UPDATE, DELETE, CREATE, DROP). Only SELECT is allowed."),
    ("human", "{query}")
])

# ── Conversational reply prompt ────────────────────────────────────────────────
reply_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert AI Data Analyst (like ChatGPT or Gemini). The user asked a question and you executed a SQL query on their dataset.\n\n"
     "SQL Query Executed:\n{sql_query}\n\n"
     "Query Result:\n{result_sample}\n\n"
     "Formulate a beautifully styled response answering the user's question. Follow these formatting rules:\n"
     "1. Structure: Use standard markdown headings (###) to separate distinct sections if detailed.\n"
     "2. Spacing: Separate paragraphs and lists with double line breaks for comfortable reading.\n"
     "3. Bullet Points: Use bold headers for list items (e.g. '- **Total Sales**: £150k...'). Keep points concise and highly scannable.\n"
     "4. Tables & Statistics: When presenting metric snapshots, summaries, or structured numeric comparisons, format them as clean markdown tables.\n"
     "5. Tone: Address the user's question directly in a friendly, executive, and professional tone. Avoid raw JSON or raw Python code blocks. Speak like a smart colleague presenting insights to a director.\n"
     "6. Accuracy: Base your answer strictly on the provided 'Query Result' values."),
    ("human", "{query}")
])


def sql_node(state: AgentState):
    """Generates SQL, registers all active datasets with DuckDB, executes query, and replies."""
    datasets = state.get("datasets", [])
    if not datasets:
        return state

    user_msg = [m for m in state["messages"] if m.type == "human"][-1].content

    try:
        conn = duckdb.connect()
        schemas_info = []
        
        for d in datasets:
            file_path = os.path.join("uploads", d)
            if not os.path.exists(file_path):
                continue
                
            base_name = os.path.basename(d)
            table_name = re.sub(r"[^a-zA-Z0-9_]", "_", base_name.replace(".csv", ""))
            
            df = pd.read_csv(file_path)
            conn.register(table_name, df)
            
            cols_str = ", ".join([f"{col} ({dtype})" for col, dtype in df.dtypes.to_dict().items()])
            schemas_info.append(f"Table Name: `{table_name}` | Schema: {cols_str}")
        
        schema_str = "\n".join(schemas_info)

        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            model="cohere/north-mini-code:free",
            temperature=0,
        )

        # Step 1: Generate SQL
        sql_chain = sql_prompt | llm
        sql_resp  = sql_chain.invoke({"schema": schema_str, "query": user_msg})
        sql_query = sql_resp.content.strip()

        match = re.search(r"```(?:sql)?\s*(.*?)\s*```", sql_query, re.DOTALL | re.IGNORECASE)
        if match:
            sql_query = match.group(1).strip()
        else:
            sql_query = re.sub(r"<think>.*?</think>", "", sql_query, flags=re.DOTALL).strip()

        # Step 2: Execute SQL
        result_sample = "Execution failed."
        execution_success = False
        try:
            result_df = conn.execute(sql_query).df()
            execution_success = True
            result_sample = result_df.head(10).to_string(index=False)
        except Exception as qe:
            sql_query = f"-- Execution failed: {str(qe)}\n{sql_query}"
        finally:
            conn.close()

        # Step 3: Generate conversational reply
        reply = ""
        if execution_success:
            try:
                reply_chain = reply_prompt | llm
                reply_resp  = reply_chain.invoke({
                    "sql_query":     sql_query,
                    "result_sample": result_sample,
                    "query":         user_msg,
                })
                reply = re.sub(r"<think>.*?</think>", "", reply_resp.content, flags=re.DOTALL).strip()
            except Exception:
                pass

        if not reply:
            reply = (
                f"I've executed the SQL query for your request. "
                f"The query ran successfully and returned {len(result_df) if execution_success else 0} row(s). "
                "You can see the full query in the SQL tab below."
            )

        current_reasoning = state.get("reasoning", "")
        status = "successfully" if execution_success else "with errors"
        new_reasoning = f"{current_reasoning}\n\nSQL Agent: Formulated and executed SQL query {status}."

        return {"sql_query": sql_query, "reply": reply, "reasoning": new_reasoning}

    except Exception as e:
        return {"error": f"SQL generation failed: {str(e)}"}
