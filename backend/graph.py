import sqlite3

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from state import AgentState
from nodes import (
    classify_node,
    retrieve_node,
    grade_node,
    tool_node,
    answer_node,
    escalate_node,
)


def route_after_classify(state):
    if state["intent"] == "docs_question":
        return "docs"
    elif state["intent"] == "action_request":
        return "action"
    else:
        return "other"


def route_after_grade(state):
    if state["confidence"] >= 0.6:
        return "good"
    else:
        return "weak"


g = StateGraph(AgentState)

g.add_node("classify", classify_node)
g.add_node("retrieve", retrieve_node)
g.add_node("grade", grade_node)
g.add_node("tool_call", tool_node)
g.add_node("answer", answer_node)
g.add_node("escalate", escalate_node)

g.set_entry_point("classify")

g.add_conditional_edges(
    "classify",
    route_after_classify,
    {
        "docs": "retrieve",
        "action": "tool_call",
        "other": "escalate",
    },
)

g.add_edge("retrieve", "grade")

g.add_conditional_edges(
    "grade",
    route_after_grade,
    {
        "good": "answer",
        "weak": "escalate",
    },
)

g.add_edge("tool_call", "answer")
g.add_edge("answer", END)
g.add_edge("escalate", END)


conn = sqlite3.connect(
    "checkpoints.db",
    check_same_thread=False
)

app = g.compile(
    checkpointer=SqliteSaver(conn)
)