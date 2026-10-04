import json
import sys
from pathlib import Path


# ============================================================
# Helpers
# ============================================================

def load_results(path):
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(
            f"Result file not found: {path}"
        )

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def percentage(value):
    if value is None:
        return "N/A"

    return f"{value * 100:.2f}%"


def delta_text(delta):
    if delta > 0:
        return f"+{delta:.4f}"

    return f"{delta:.4f}"


def get_case_map(data):
    return {
        case["question"]: case
        for case in data.get("results", [])
    }


def get_case_pass(case):
    """
    Overall case status.

    For ordinary answerable cases:
        correctness determines pass/fail.

    For cases where correctness is not applicable:
        escalation accuracy determines pass/fail.

    Citation accuracy is reported separately and does not
    override the main case verdict.
    """

    correctness = case.get(
        "correctness",
        {}
    )

    escalation = case.get(
        "escalation_accuracy",
        {}
    )

    if correctness.get("applicable"):
        return correctness.get("passed")

    return escalation.get("passed")


# ============================================================
# Main
# ============================================================

def main():

    if len(sys.argv) != 3:
        print()
        print("Usage:")
        print(
            "python compare.py "
            "results/v1.json results/v2.json"
        )
        print()
        sys.exit(1)

    old_path = sys.argv[1]
    new_path = sys.argv[2]

    old = load_results(old_path)
    new = load_results(new_path)

    old_metrics = old.get(
        "metrics",
        {}
    )

    new_metrics = new.get(
        "metrics",
        {}
    )

    # ========================================================
    # Header
    # ========================================================

    print("=" * 70)
    print("SUPPORTOPS EVALUATION COMPARISON")
    print("=" * 70)

    print()
    print(
        f"OLD: {old.get('version', old_path)}"
    )

    print(
        f"NEW: {new.get('version', new_path)}"
    )

    print()

    # ========================================================
    # Metric deltas
    # ========================================================

    print("-" * 70)
    print("METRIC DELTAS")
    print("-" * 70)

    metric_names = [
        (
            "Correctness",
            "correctness",
            "average"
        ),
        (
            "Citation accuracy",
            "citation_accuracy",
            "average"
        ),
        (
            "Escalation accuracy",
            "escalation_accuracy",
            "average"
        ),
        (
            "Average latency (ms)",
            "latency_ms",
            "average"
        ),
        (
            "Average token cost",
            "token_cost",
            "average"
        )
    ]

    for label, metric, field in metric_names:

        old_value = old_metrics.get(
            metric,
            {}
        ).get(field)

        new_value = new_metrics.get(
            metric,
            {}
        ).get(field)

        if (
            old_value is None
            or new_value is None
        ):
            print(
                f"{label}: "
                f"{old_value} -> {new_value} "
                f"(delta unavailable)"
            )

            continue

        delta = new_value - old_value

        if metric == "latency_ms":
            print(
                f"{label}: "
                f"{old_value:.2f} -> "
                f"{new_value:.2f} "
                f"({delta:+.2f} ms)"
            )

        else:
            print(
                f"{label}: "
                f"{percentage(old_value)} -> "
                f"{percentage(new_value)} "
                f"({delta:+.2%})"
            )

    # ========================================================
    # Case comparison
    # ========================================================

    old_cases = get_case_map(old)
    new_cases = get_case_map(new)

    common_questions = sorted(
        set(old_cases.keys())
        & set(new_cases.keys())
    )

    pass_to_fail = []
    fail_to_pass = []

    for question in common_questions:

        old_pass = get_case_pass(
            old_cases[question]
        )

        new_pass = get_case_pass(
            new_cases[question]
        )

        if old_pass is True and new_pass is False:

            pass_to_fail.append(question)

        elif old_pass is False and new_pass is True:

            fail_to_pass.append(question)

    # ========================================================
    # Regressions
    # ========================================================

    print()
    print("-" * 70)
    print("REGRESSIONS: PASS -> FAIL")
    print("-" * 70)

    if not pass_to_fail:
        print("None")

    else:

        for number, question in enumerate(
            pass_to_fail,
            start=1
        ):
            print(
                f"{number}. {question}"
            )

    # ========================================================
    # Improvements
    # ========================================================

    print()
    print("-" * 70)
    print("IMPROVEMENTS: FAIL -> PASS")
    print("-" * 70)

    if not fail_to_pass:
        print("None")

    else:

        for number, question in enumerate(
            fail_to_pass,
            start=1
        ):
            print(
                f"{number}. {question}"
            )

    # ========================================================
    # Case counts
    # ========================================================

    print()
    print("-" * 70)
    print("SUMMARY")
    print("-" * 70)

    print(
        f"Common cases compared: "
        f"{len(common_questions)}"
    )

    print(
        f"Pass -> Fail: "
        f"{len(pass_to_fail)}"
    )

    print(
        f"Fail -> Pass: "
        f"{len(fail_to_pass)}"
    )

    print()

    if pass_to_fail:
        print(
            "⚠ Regressions detected."
        )
    else:
        print(
            "✓ No pass-to-fail regressions detected."
        )


if __name__ == "__main__":
    main()