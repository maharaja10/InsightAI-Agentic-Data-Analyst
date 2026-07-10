import pandas as pd
import numpy as np

def run_pandas_code(code: str, df: pd.DataFrame = None, dfs: dict = None) -> dict:
    """
    Executes pandas code in a restricted environment.
    The code should define a variable `result` which contains the final output (DataFrame, Series, or value).
    """
    safe_locals = {
        "pd": pd,
        "np": np,
        "result": None
    }
    
    if df is not None:
        safe_locals["df"] = df
        
    if dfs:
        for name, dataframe in dfs.items():
            safe_locals[f"df_{name}"] = dataframe
            if "df" not in safe_locals:
                safe_locals["df"] = dataframe
                
    try:
        exec(code, {}, safe_locals)
        result = safe_locals.get("result")
        
        return {
            "success": True,
            "result": result,
            "output_str": str(result)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

