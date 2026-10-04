from typing import TypedDict, List, Optional

class AgentState(TypedDict):
    question: str
    intent: str              # "docs_question" | "action_request" | "other"
    chunks: List[dict]
    confidence: float        # 0 to 1, from the grader
    answer: Optional[str]
    escalated: bool
    trace: List[str]         # log of steps, for observability later