import os
import pandas as pd
from graphs.state import AgentState
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from tools.pandas_tool import run_pandas_code
import re

# ── Code generation prompt ─────────────────────────────────────────────────────
code_gen_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are an expert Python Pandas data analyst.\n"
     "Given a user query and a set of available DataFrames, determine if answering the query requires querying, calculating, filtering, or analyzing data across the datasets.\n"
     "If it does, write a clean, single-statement Python Pandas code block to extract the exact result.\n\n"
     "Available DataFrames and Schemas:\n{schema}\n"
     "Data Preview (first 10 rows):\n{data_preview}\n\n"
     "RULES:\n"
     "1. The DataFrames are ALREADY loaded in memory as variable names shown above (e.g. `df_sales_data`). Do NOT write `pd.read_csv()` to load any files. Use the variables directly.\n"
     "2. Assign the final query result to the variable `result` (e.g. `result = pd.merge(df_sales_data, df_customers, on='id')`).\n"
     "3. Write ONLY raw python code. DO NOT include markdown code blocks, comments, or extra text. Your output must be directly executable.\n"
     "4. For numeric operations (like `.sum()`, `.mean()`, etc.), ensure they are executed on numeric columns to prevent type errors.\n"
     "5. Date Filters: For any date-based filtering or grouping (e.g. year, month, or matching specific dates), always convert the column to datetime first in your code: `df_some_table['Date_Column'] = pd.to_datetime(df_some_table['Date_Column'], errors='coerce')` before performing logic operations.\n"
     "6. Case-Insensitive Strings: For text matches or groupings on user queries, convert strings to lowercase and strip whitespace (e.g. `df_some_table[df_some_table['Product'].str.lower().str.strip() == 'keyboard']`) to prevent mismatches from mixed casing or trailing spaces in the dataset.\n"
     "7. If the query does not require querying/calculation on the dataset (e.g., general conversation or metadata query), output exactly 'NO_CODE' and nothing else.\n"
     "8. Merging/Joining: When merging or joining multiple DataFrames, ALWAYS use `pd.merge(df1, df2, on='common_column')` or specify `left_on` and `right_on`. Do NOT use `df1.join(df2)` directly without resetting indexes, as it will throw 'cannot join with no overlapping index names' errors."),
    ("human", "{query}")
])

# ── Final reply prompt ─────────────────────────────────────────────────────────
conversational_reply_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert AI Data Analyst (like ChatGPT or Gemini). Your role is to help users analyze and understand their uploaded CSV dataset through clear, structured, and visually polished responses.\n\n"
     "Available DataFrames and Schemas:\n{schema}\n"
     "User Query: {query}\n\n"
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

# ── Fallback prompt (when no code is run) ──────────────────────────────────────
general_prompt = ChatPromptTemplate.from_messages([
    ("system",
     "You are a premium, expert AI Data Analyst (like ChatGPT or Gemini). Your role is to help users analyze and understand their uploaded CSV dataset through clear, structured, and visually polished responses.\n\n"
     "Available DataFrames and Schemas:\n{schema}\n"
     "Data Preview (first 10 rows):\n{data_preview}\n\n"
     "RESPONSE FORMAT & STYLE RULES:\n"
     "1. Structure: Use standard markdown headings (###) to separate distinct sections. Never return a single massive block of text.\n"
     "2. Spacing: Separate paragraphs and lists with double line breaks for comfortable reading.\n"
     "3. Bullet Points: Use bold headers for list items (e.g. '- **Completeness**: No missing values found...'). Keep points concise and highly scannable.\n"
     "4. Tables & Statistics: When presenting metric snapshots, summaries, or structured numeric comparisons, format them as clean markdown tables.\n"
     "5. Tone: Address the user's question directly in a friendly, executive, and professional tone. Avoid raw JSON or raw Python code blocks. Speak like a smart colleague presenting insights to a director."),
    ("human", "{query}")
])


def general_chatbot_node(state: AgentState):
    """Executes a single conversational LLM call, executing Pandas code on all active DataFrames if necessary."""
    datasets = state.get("datasets", [])
    if not datasets:
        return {"reply": "Please upload a CSV dataset first so I can help you analyze it!"}

    user_msg = [m for m in state["messages"] if m.type == "human"][-1].content

    try:
        dfs = {}
        schemas_info = []
        previews_info = []
        
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
            previews_info.append(f"DataFrame: `df_{table_name}` Preview:\n{df.head(10).to_string(index=False)}")
            
        schema_str = "\n".join(schemas_info)
        data_preview = "\n\n".join(previews_info)

        llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ.get("OPENROUTER_API_KEY"),
            model="cohere/north-mini-code:free",
            temperature=0.0,
        )

        # Step 1: Request code generation if needed
        code_gen_chain = code_gen_prompt | llm
        code_resp = code_gen_chain.invoke({
            "schema": schema_str,
            "data_preview": data_preview,
            "query": user_msg,
        })
        
        pandas_code = re.sub(r"<think>.*?</think>", "", code_resp.content, flags=re.DOTALL).strip()
        match = re.search(r"```(?:python)?\s*(.*?)\s*```", pandas_code, re.DOTALL | re.IGNORECASE)
        if match:
            pandas_code = match.group(1).strip()
        
        if pandas_code and pandas_code != "NO_CODE":
            # Run code on all loaded DataFrames with Self-Correction / Self-Healing loop
            exec_result = run_pandas_code(pandas_code, dfs=dfs)
            attempts = 1
            max_attempts = 2
            
            while not exec_result["success"] and attempts < max_attempts:
                error_feedback = exec_result.get("error")
                retry_prompt = ChatPromptTemplate.from_messages([
                    ("system",
                     "You are an expert Python Pandas data analyst. Your previous code block threw an exception.\n"
                     "Available DataFrames and Schemas:\n{schema}\n"
                     "Previous Code:\n{previous_code}\n"
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

            if exec_result["success"]:
                result_output = str(exec_result["result"])
                
                # Step 2: Formulate reply using execution results
                reply_chain = conversational_reply_prompt | llm
                reply_resp = reply_chain.invoke({
                    "schema": schema_str,
                    "query": user_msg,
                    "pandas_code": pandas_code,
                    "result_output": result_output,
                })
                reply = re.sub(r"<think>.*?</think>", "", reply_resp.content, flags=re.DOTALL).strip()
                reasoning = f"General Chatbot Agent: Executed Pandas query `{pandas_code}` successfully and summarized the results."
                return {
                    "reply": reply,
                    "insights": reply,
                    "reasoning": reasoning
                }
            else:
                # If code failed, fallback to general prompt with error context
                error_msg = exec_result.get("error", "Code run failed.")
                reply_chain = general_prompt | llm
                reply_resp = reply_chain.invoke({
                    "schema": schema_str,
                    "data_preview": data_preview,
                    "query": f"{user_msg} (Note: code execution failed with error: {error_msg})",
                })
                reply = re.sub(r"<think>.*?</think>", "", reply_resp.content, flags=re.DOTALL).strip()
                reasoning = f"General Chatbot Agent: Tried executing pandas query `{pandas_code}` but it failed: {error_msg}. Fell back to general conversational reply."
                return {
                    "reply": reply,
                    "insights": reply,
                    "reasoning": reasoning
                }
        else:
            # Step 2: General/conversational reply directly
            reply_chain = general_prompt | llm
            reply_resp = reply_chain.invoke({
                "schema": schema_str,
                "data_preview": data_preview,
                "query": user_msg,
            })
            reply = re.sub(r"<think>.*?</think>", "", reply_resp.content, flags=re.DOTALL).strip()
            reasoning = "General Chatbot Agent: Answered query directly without data calculation."
            return {
                "reply": reply,
                "insights": reply,
                "reasoning": reasoning
            }

    except Exception as e:
        return {"error": f"General chatbot failed: {str(e)}"}
