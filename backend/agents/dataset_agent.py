import pandas as pd
import os
from graphs.state import AgentState

def dataset_node(state: AgentState):
    """Validates CSV and detects schema."""
    datasets = state.get("datasets", [])
    if not datasets:
        return {"error": "No dataset provided."}
    
    current_dataset = datasets[0]
    file_path = os.path.join("uploads", current_dataset)
    
    try:
        df = pd.read_csv(file_path)
        schema = df.dtypes.to_dict()
        schema_str = ", ".join([f"{k} ({v})" for k, v in schema.items()])
        
        reasoning = f"Loaded {current_dataset}. Found {len(df)} rows and {len(df.columns)} columns. Schema: {schema_str}."
        
        # We append reasoning if it exists
        current_reasoning = state.get("reasoning", "")
        new_reasoning = f"{current_reasoning}\n\nDataset Agent: {reasoning}" if current_reasoning else reasoning
        
        return {"current_dataset": current_dataset, "reasoning": new_reasoning}
    except Exception as e:
        return {"error": f"Failed to load dataset: {str(e)}"}
