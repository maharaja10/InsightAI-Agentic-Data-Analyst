import pandas as pd
import os
import re
from graphs.state import AgentState
from tools.pandas_tool import run_pandas_code
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

# ── Code generation prompt ─────────────────────────────────────────────────────
pandas_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an elite Pandas data scientist. Write a single executable Python snippet to answer the user's query.\n\n"
     "Available DataFrames and Schemas:\n{schema}\n\n"
     "RULES:\n"
     "1. The DataFrames are ALREADY loaded in memory as variables (e.g. `df_sales_data`). Do NOT write `pd.read_csv()` to load any files. Use the variables directly.\n"
     "2. Assign the final result to the variable `result` (e.g. `result = pd.merge(df_sales_data, df_customers, on='id')`).\n"
     "3. Output ONLY raw executable Python code. Do NOT wrap in markdown blocks (no ```python), no comments, and no extra text.\n"
     "4. For calculations like correlation (`.corr()`), mean (`.mean()`), sum (`.sum()`), etc., ensure they are run only on numeric columns to prevent errors.\n"
     "5. Date Filters: For any date-based operations or groupings, convert the column to datetime first: `df_some_table['Date_Column'] = pd.to_datetime(df_some_table['Date_Column'], errors='coerce')` in your snippet.\n"
     "6. Case-Insensitive Strings: Strip and lowercase text values when comparing categories, items, or user inputs: `df_some_table[df_some_table['Product'].str.lower().str.strip() == 'sofa']` to ensure match hits.\n"
     "7. Limit operations: Assign a single value, Series, or DataFrame to `result`. Do not call `.show()`, `.plot()`, or save to files.\n"
     "8. Merging/Joining: When merging or joining multiple DataFrames, ALWAYS use `pd.merge(df1, df2, on='common_column')` or specify `left_on` and `right_on`. Do NOT use `df1.join(df2)` directly without resetting indexes, as it will throw 'cannot join with no overlapping index names' errors."),
    ("human", "{query}")
])

# ── Conversational reply prompt ────────────────────────────────────────────────
reply_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert AI Data Analyst (like ChatGPT or Gemini). Your role is to help users analyze and understand their uploaded CSV dataset through clear, structured, and visually polished responses.\n\n"
     "Python Code Executed:\n{pandas_code}\n\n"
     "Execution Result:\n{result_output}\n\n"
     "Generate a beautifully styled response answering the user's query based strictly on the 'Execution Result'. Follow these formatting rules:\n"
     "1. Structure: Use standard markdown headings (###) to separate distinct sections when the response is detailed.\n"
     "2. Spacing: Separate paragraphs and lists with double line breaks for comfortable reading.\n"
     "3. Bullet Points: Use bold headers for list items (e.g. '- **Top Customer**: John Doe...'). Keep points concise and highly scannable.\n"
     "4. Tables & Statistics: When presenting metric snapshots, summaries, or structured numeric comparisons, format them as clean markdown tables.\n"
     "5. Tone: Address the user's question directly in a friendly, executive, and professional tone. Avoid raw JSON or raw Python code blocks. Speak like a smart colleague presenting insights to a director.\n"
     "6. Accuracy: Be precise and correct. Base your answer strictly on the provided 'Execution Result'."),
    ("human", "{query}")
])


def analysis_node(state: AgentState):
    """Generates Pandas code, executes it, then gives a conversational answer."""
    datasets = state.get("datasets", [])
    if not datasets:
        return state

    user_msg  = [m for m in state["messages"] if m.type == "human"][-1].content

    try:
        dfs = {}
        schemas_info = []
        
        for d in datasets:
            file_path = os.path.join("uploads", d)
            if not os.path.exists(file_path):
                continue
                
            base_name = os.path.basename(d)
            table_name = re.sub(r"[^a-zA-Z0-9_]", "_", base_name.replace(".csv", ""))
            
            df = pd.read_csv(file_path)
            dfs[table_name] = df
            
            cols_str = ", ".join([f"{col} ({dtype})" for col, dtype in df.dtypes.to_dict().items()])
            schemas_info.append(f"DataFrame: `df_{table_name}` | Schema: {cols_str}")
            
        schema_str = "\n".join(schemas_info)

        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            model="cohere/north-mini-code:free",
            temperature=0,
        )

        # Step 1: Generate pandas code
        code_chain  = pandas_prompt | llm
        code_resp   = code_chain.invoke({"schema": schema_str, "query": user_msg})
        pandas_code = code_resp.content.strip()

        match = re.search(r"```(?:python)?\s*(.*?)\s*```", pandas_code, re.DOTALL | re.IGNORECASE)
        if match:
            pandas_code = match.group(1).strip()
        else:
            pandas_code = re.sub(r"<think>.*?</think>", "", pandas_code, flags=re.DOTALL).strip()

        # Step 2: Execute the code with Self-Correction / Self-Healing loop
        exec_result = run_pandas_code(pandas_code, dfs=dfs)
        attempts = 1
        max_attempts = 2
        
        while not exec_result["success"] and attempts < max_attempts:
            error_feedback = exec_result.get("error")
            retry_prompt = ChatPromptTemplate.from_messages([
                ("system",
                 "You are an elite Pandas data scientist. Your previous Python snippet threw an exception.\n"
                 "Available DataFrames and Schemas:\n{schema}\n\n"
                 "Previous Code:\n{previous_code}\n\n"
                 "Error Encountered:\n{error}\n\n"
                 "RULES:\n"
                 "1. Correct the code to avoid this error. Ensure all columns and table variables are matched correctly.\n"
                 "2. Write ONLY raw executable Python code. Assign the final output to the variable `result`.\n"
                 "3. Output ONLY raw executable Python code. Do NOT wrap in markdown blocks, no comments, and no extra text.\n"
                 "4. Merging/Joining: When merging or joining multiple DataFrames, ALWAYS use `pd.merge(df1, df2, on='common_column')` or specify `left_on` and `right_on`. Do NOT use `df1.join(df2)` directly as it will throw errors."),
                ("human", "{query}")
            ])
            retry_chain = retry_prompt | llm
            retry_resp = retry_chain.invoke({
                "schema": schema_str,
                "previous_code": pandas_code,
                "error": error_feedback,
                "query": user_msg
            })
            pandas_code = retry_resp.content.strip()
            
            match = re.search(r"```(?:python)?\s*(.*?)\s*```", pandas_code, re.DOTALL | re.IGNORECASE)
            if match:
                pandas_code = match.group(1).strip()
            else:
                pandas_code = re.sub(r"<think>.*?</think>", "", pandas_code, flags=re.DOTALL).strip()
                
            exec_result = run_pandas_code(pandas_code, dfs=dfs)
            attempts += 1

        current_reasoning = state.get("reasoning", "")

        if not exec_result["success"]:
            new_reasoning = f"{current_reasoning}\n\nAnalysis Agent: Failed to execute pandas code after self-healing. {exec_result.get('error')}"
            return {"error": exec_result.get("error"), "reasoning": new_reasoning}

        # Step 3: Conversational reply from result
        result_output = str(exec_result.get("result", "Result unavailable"))[:1000]

        reply = ""
        try:
            reply_chain = reply_prompt | llm
            reply_resp  = reply_chain.invoke({
                "pandas_code":   pandas_code,
                "result_output": result_output,
                "query":         user_msg,
            })
            reply = re.sub(r"<think>.*?</think>", "", reply_resp.content, flags=re.DOTALL).strip()
        except Exception:
            pass

        if not reply:
            reply = (
                "I've run the Pandas analysis on your dataset. "
                "You can see the code I used in the Pandas tab below, "
                "and the result is ready for your review."
            )

        new_reasoning = f"{current_reasoning}\n\nAnalysis Agent: Successfully executed pandas code and generated a conversational reply."
        return {
            "pandas_code": pandas_code,
            "insights":    reply,   # surface in insights tab too
            "reply":       reply,
            "reasoning":   new_reasoning,
        }

    except Exception as e:
        return {"error": f"Analysis failed: {str(e)}"}
