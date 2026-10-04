import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from langchain_groq import ChatGroq


BASE_DIR = Path(__file__).resolve().parent
GOLDEN_PATH = BASE_DIR / "golden.json"
RESULTS_DIR = BASE_DIR / "results"
OUTPUT_PATH = RESULTS_DIR / "v2.json"
API_URL = "http://127.0.0.1:8000/chat"

BACKEND_ENV = BASE_DIR.parent / "backend" / ".env"
load_dotenv(BACKEND_ENV)


judge = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0,
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run SupportOps evaluation suite."
    )

    parser.add_argument(
        "--fail-under",
        type=float,
        default=None,
        help=(
            "Exit with code 1 when the correctness average "
            "is below this threshold."
        ),
    )

    return parser.parse_args()


def load_golden_dataset():
    with open(GOLDEN_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_citation_markers(answer):
    if not answer:
        return []

    return [
        int(number)
        for number in re.findall(r"\[(\d+)\]", answer)
    ]


def get_citation_urls(answer, citations):
    markers = extract_citation_markers(answer)

    urls = []

    for marker in markers:
        index = marker - 1

        if 0 <= index < len(citations):
            source_url = citations[index].get("source_url")

            if source_url:
                urls.append(source_url)

    return urls


def judge_answer(question, answer, expected_sources):
    if not answer:
        return False

    expected_text = ", ".join(expected_sources)

    prompt = f"""
You are evaluating whether an AI support agent answered a question correctly.

Question:
{question}

Agent answer:
{answer}

Expected source URLs:
{expected_text}

Judge ONLY whether the answer is substantively correct based on the
expected documentation sources.

Return ONLY valid JSON:

{{"correct": true}}

or

{{"correct": false}}
"""

    try:
        response = judge.bind(
            response_format={"type": "json_object"}
        ).invoke(prompt)

        result = json.loads(response.content)

        return bool(result.get("correct", False))

    except Exception as e:
        print(f"Judge error: {e}")
        return False


def call_api(question):
    started_at = time.perf_counter()

    response = requests.post(
        API_URL,
        json={"question": question},
        timeout=180,
    )

    latency_ms = int(
        (time.perf_counter() - started_at) * 1000
    )

    response.raise_for_status()

    return response.json(), latency_ms


def get_latest_run(question):
    try:
        from supabase import create_client

        db = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY"),
        )

        query = (
            db.table("runs")
            .select(
                "question,intent,confidence,escalated,"
                "latency_ms,trace,created_at"
            )
            .eq("question", question)
            .order("created_at", desc=True)
            .limit(1)
        )

        result = query.execute()

        if result.data:
            return result.data[0]

    except Exception as e:
        print(f"Could not read run log: {e}")

    return None


def main():
    args = parse_args()

    RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    golden = load_golden_dataset()

    results = []

    total = len(golden)

    print()
    print("=" * 70)
    print("SUPPORTOPS AGENT EVALUATION")
    print("=" * 70)

    print(f"Total cases: {total}")
    print(f"API: {API_URL}")
    print(f"Output: {OUTPUT_PATH}")

    if args.fail_under is not None:
        print(
            f"Fail-under threshold: "
            f"{args.fail_under:.3f}"
        )

    print("=" * 70)
    print()

    for index, case in enumerate(
        golden,
        start=1,
    ):
        case_id = index

        question = case["q"]

        print(
            f"[{index}/{total}] "
            f"Case {case_id}: {question}"
        )

        try:
            api_result, measured_latency_ms = call_api(
                question
            )

            answer = api_result.get("answer")

            actual_escalated = bool(
                api_result.get(
                    "escalated",
                    False,
                )
            )

            citations = api_result.get(
                "citations",
                [],
            )

            expected_sources = case.get(
                "expected_sources",
                [],
            )

            should_escalate = bool(
                case.get(
                    "should_escalate",
                    False,
                )
            )

            cited_urls = get_citation_urls(
                answer,
                citations,
            )

            citation_pass = True

            if expected_sources:
                citation_pass = any(
                    url in expected_sources
                    for url in cited_urls
                )

            escalation_pass = (
                actual_escalated
                == should_escalate
            )

            correctness = None

            if (
                not actual_escalated
                and not should_escalate
            ):
                correctness = judge_answer(
                    question,
                    answer,
                    expected_sources,
                )

            run_log = get_latest_run(
                question
            )

            if run_log:
                intent = run_log.get(
                    "intent"
                )

                confidence = run_log.get(
                    "confidence"
                )

                logged_escalated = run_log.get(
                    "escalated"
                )

                logged_latency_ms = run_log.get(
                    "latency_ms"
                )

                trace = run_log.get(
                    "trace"
                )

            else:
                intent = api_result.get(
                    "intent"
                )

                confidence = api_result.get(
                    "confidence"
                )

                logged_escalated = (
                    actual_escalated
                )

                logged_latency_ms = (
                    measured_latency_ms
                )

                trace = api_result.get(
                    "trace",
                    [],
                )

            if logged_latency_ms is None:
                logged_latency_ms = (
                    measured_latency_ms
                )

            result = {
                "id": case_id,
                "question": question,
                "type": case.get("type"),
                "expected": {
                    "should_escalate": (
                        should_escalate
                    ),
                    "expected_sources": (
                        expected_sources
                    ),
                    "reference": case.get(
                        "reference"
                    ),
                },
                "actual": {
                    "answer": answer,
                    "escalated": (
                        actual_escalated
                    ),
                    "intent": intent,
                    "confidence": confidence,
                    "citations": citations,
                    "cited_urls": cited_urls,
                    "trace": trace,
                },
                "evaluation": {
                    "correct": correctness,
                    "citation_pass": (
                        citation_pass
                    ),
                    "escalation_pass": (
                        escalation_pass
                    ),
                    "latency_ms": (
                        logged_latency_ms
                    ),
                    "token_cost": None,
                },
            }

            results.append(result)

            print(
                f"  intent={intent} "
                f"| confidence={confidence} "
                f"| escalated={actual_escalated}"
            )

            print(
                f"  correct={correctness} "
                f"| citation={citation_pass} "
                f"| escalation={escalation_pass} "
                f"| latency={logged_latency_ms}ms"
            )

        except Exception as e:
            print(
                f"  ERROR: {e}"
            )

            results.append({
                "id": case_id,
                "question": question,
                "type": case.get("type"),
                "expected": {
                    "should_escalate": (
                        case.get(
                            "should_escalate",
                            False,
                        )
                    ),
                    "expected_sources": (
                        case.get(
                            "expected_sources",
                            [],
                        )
                    ),
                    "reference": case.get(
                        "reference"
                    ),
                },
                "actual": {},
                "evaluation": {
                    "correct": False,
                    "citation_pass": False,
                    "escalation_pass": False,
                    "latency_ms": None,
                    "token_cost": None,
                    "error": str(e),
                },
            })

        if index < total:
            time.sleep(2)

    correctness_values = [
        r["evaluation"]["correct"]
        for r in results
        if r["evaluation"]["correct"]
        is not None
    ]

    citation_values = [
        r["evaluation"]["citation_pass"]
        for r in results
        if r["expected"]["expected_sources"]
    ]

    escalation_values = [
        r["evaluation"]["escalation_pass"]
        for r in results
    ]

    latency_values = [
        r["evaluation"]["latency_ms"]
        for r in results
        if r["evaluation"]["latency_ms"]
        is not None
    ]

    correctness_average = (
        sum(correctness_values)
        / len(correctness_values)
        if correctness_values
        else 0
    )

    citation_accuracy = (
        sum(citation_values)
        / len(citation_values)
        if citation_values
        else 0
    )

    escalation_accuracy = (
        sum(escalation_values)
        / len(escalation_values)
        if escalation_values
        else 0
    )

    average_latency = (
        sum(latency_values)
        / len(latency_values)
        if latency_values
        else 0
    )

    summary = {
        "version": "v2",
        "total_cases": total,
        "metrics": {
            "correctness_average": (
                correctness_average
            ),
            "citation_accuracy": (
                citation_accuracy
            ),
            "escalation_accuracy": (
                escalation_accuracy
            ),
            "average_latency_ms": (
                average_latency
            ),
            "token_cost": None,
        },
        "results": results,
    }

    with open(
        OUTPUT_PATH,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            summary,
            f,
            indent=2,
            ensure_ascii=False,
        )

    print()
    print("=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)

    print(
        f"Correctness average: "
        f"{correctness_average:.3f}"
    )

    print(
        f"Citation accuracy: "
        f"{citation_accuracy:.3f}"
    )

    print(
        f"Escalation accuracy: "
        f"{escalation_accuracy:.3f}"
    )

    print(
        f"Average latency: "
        f"{average_latency:.2f} ms"
    )

    print(
        "Token cost: unavailable"
    )

    print()
    print(
        f"Results saved to: "
        f"{OUTPUT_PATH}"
    )

    print("=" * 70)

    # --------------------------------------------------------
    # CI FAILURE GATE
    # --------------------------------------------------------

    if args.fail_under is not None:
        if correctness_average < args.fail_under:
            print()
            print(
                "FAIL: correctness average "
                f"{correctness_average:.3f} "
                f"is below required threshold "
                f"{args.fail_under:.3f}"
            )

            sys.exit(1)

        print()
        print(
            "PASS: correctness average "
            f"{correctness_average:.3f} "
            f"meets threshold "
            f"{args.fail_under:.3f}"
        )


if __name__ == "__main__":
    main()