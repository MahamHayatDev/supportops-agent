import json
import os
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from langgraph.types import Command

from graph import app


load_dotenv()


db = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)


api = FastAPI(title="SupportOps Agent")


# Allow the Next.js dashboard to communicate with FastAPI.
api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str


class ReviewBody(BaseModel):
    status: str
    final_answer: str


@api.post("/chat")
def chat(request: ChatRequest):
    start_time = time.perf_counter()

    thread_id = str(uuid.uuid4())

    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    initial_state = {
        "question": request.question,
        "intent": "",
        "chunks": [],
        "confidence": 0.0,
        "answer": None,
        "escalated": False,
        "trace": [],
    }

    result = app.invoke(
        initial_state,
        config
    )

    latency_ms = int(
        (time.perf_counter() - start_time) * 1000
    )

    state_snapshot = app.get_state(config)
    interrupts = state_snapshot.interrupts

    is_interrupted = bool(interrupts)

    db.table("runs").insert({
        "question": request.question,
        "intent": result.get("intent", ""),
        "confidence": result.get("confidence", 0.0),
        "escalated": is_interrupted,
        "latency_ms": latency_ms,
        "trace": result.get("trace", []),
    }).execute()

    if is_interrupted:
        payload = interrupts[0].value

        db.table("review_queue").insert({
            "thread_id": thread_id,
            "question": payload["question"],
            "draft_answer": payload.get("draft"),
            "reason": payload["reason"],
        }).execute()

        return {
            "status": "pending_review",
            "thread_id": thread_id,
            "answer": payload.get("draft"),
            "confidence": result.get("confidence", 0.0),
            "escalated": True,
            "trace": result.get("trace", []),
            "citations": [],
        }

    citations = [
        {
            "source_url": chunk["source_url"],
            "title": chunk["title"],
        }
        for chunk in result.get("chunks", [])
        if chunk.get("source_url") != "mock_tool"
    ]

    return {
        "status": "answered",
        "answer": result.get("answer"),
        "citations": citations,
        "confidence": result.get("confidence", 0.0),
        "escalated": result.get("escalated", False),
        "trace": result.get("trace", []),
        "thread_id": thread_id,
    }


@api.get("/review")
def get_reviews():
    result = (
        db.table("review_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )

    return result.data


@api.get("/runs")
def get_runs():
    result = (
        db.table("runs")
        .select("*")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )

    return result.data


def load_eval_file(filename):
    """
    Load an evaluation JSON file using UTF-8.
    Looks in backend/eval_results first (used when deployed),
    then falls back to evals/results one level above backend.
    """

    backend_dir = Path(__file__).resolve().parent

    file_path = backend_dir / "eval_results" / filename

    if not file_path.exists():
        file_path = backend_dir.parent / "evals" / "results" / filename

    with open(
        file_path,
        "r",
        encoding="utf-8"
    ) as file:
        return json.load(file)


def pick(metrics, *keys, default=0):
    """
    Return the first metric that exists under any of the given key names.
    Result files have used different names for the same metric.
    """

    for key in keys:
        if key in metrics and metrics[key] is not None:
            return metrics[key]

    return default


@api.get("/evals")
def get_evals():
    """
    Return the latest evaluation results from v2.json.
    Also include v1 and v2 metrics so the dashboard
    can display evaluation history.
    """

    v1 = load_eval_file("v1.json")
    v2 = load_eval_file("v2.json")

    v1_metrics = v1.get("metrics", {})
    v2_metrics = v2.get("metrics", {})

    return {
        "version": v2.get("version", "v2"),
        "total_cases": v2.get("total_cases", 0),

        "correctness": pick(
            v2_metrics,
            "correctness",
            "correctness_average"
        ),

        "citation_accuracy": pick(
            v2_metrics,
            "citation_accuracy"
        ),

        "escalation_accuracy": pick(
            v2_metrics,
            "escalation_accuracy"
        ),

        "avg_latency_ms": pick(
            v2_metrics,
            "avg_latency_ms",
            "average_latency_ms"
        ),

        "token_cost": v2_metrics.get(
            "token_cost"
        ),

        "results": v2.get(
            "results",
            []
        ),

        "versions": [
            {
                "version": v1.get(
                    "version",
                    "v1"
                ),
                "correctness": pick(
                    v1_metrics,
                    "correctness",
                    "correctness_average"
                ),
                "citation_accuracy": pick(
                    v1_metrics,
                    "citation_accuracy"
                ),
                "escalation_accuracy": pick(
                    v1_metrics,
                    "escalation_accuracy"
                ),
                "avg_latency_ms": pick(
                    v1_metrics,
                    "avg_latency_ms",
                    "average_latency_ms"
                ),
            },
            {
                "version": v2.get(
                    "version",
                    "v2"
                ),
                "correctness": pick(
                    v2_metrics,
                    "correctness",
                    "correctness_average"
                ),
                "citation_accuracy": pick(
                    v2_metrics,
                    "citation_accuracy"
                ),
                "escalation_accuracy": pick(
                    v2_metrics,
                    "escalation_accuracy"
                ),
                "avg_latency_ms": pick(
                    v2_metrics,
                    "avg_latency_ms",
                    "average_latency_ms"
                ),
            },
        ],
    }


@api.post("/review/{thread_id}")
def review(thread_id: str, body: ReviewBody):
    config = {
        "configurable": {
            "thread_id": thread_id
        }
    }

    result = app.invoke(
        Command(resume=body.final_answer),
        config
    )

    db.table("review_queue").update({
        "status": body.status,
        "final_answer": body.final_answer
    }).eq(
        "thread_id",
        thread_id
    ).execute()

    return {
        "answer": result["answer"]
    }