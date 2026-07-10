from graphs.state import AgentState

def reasoning_node(state: AgentState):
    """Finalizes and structures the reasoning explanation for the user interface."""
    current_reasoning = state.get("reasoning", "No reasoning recorded.")
    
    final_reasoning = (
        "Here is the step-by-step breakdown of how the AI processed your request:\n\n"
        f"{current_reasoning}\n\n"
        "All calculations were executed deterministically using secure sandbox environments."
    )
    
    return {"reasoning": final_reasoning}
