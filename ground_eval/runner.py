"""Command-line runner for Groq grounding evaluation."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

try:
    from .config import DEFAULT_SYSTEM_PROMPT
    from .groq_client import GroqClientError, generate_response
    from .report import (
        build_report,
        evaluate_output,
        write_json_report,
        write_markdown_report,
    )
    from .tests import load_tests
except ImportError:  # Support `python -m runner` from inside `ground_eval/`.
    from config import DEFAULT_SYSTEM_PROMPT
    from groq_client import GroqClientError, generate_response
    from report import build_report, evaluate_output, write_json_report, write_markdown_report
    from tests import load_tests


def _load_local_env() -> None:
    """Load variables from robophone/.env into the process environment."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def _load_document(document_path: str | Path) -> str:
    path = Path(document_path)
    if not path.exists():
        raise FileNotFoundError(f"Document file not found: {path}")
    return path.read_text(encoding="utf-8")


def _load_baseline_document() -> tuple[str, str]:
    baseline_path = Path(__file__).resolve().parent / "robophone_llm_baseline_instructions.md"
    return str(baseline_path), _load_document(baseline_path)


def _build_baseline_output_path(output_path: str | Path) -> Path:
    path = Path(output_path)
    return path.with_name(f"{path.stem}_baseline{path.suffix}")


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Evaluate Groq responses against a Robophone grounding document."
    )
    parser.add_argument("--doc", required=True, help="Path to the grounding document.")
    parser.add_argument("--tests", required=True, help="Path to the JSON tests file.")
    parser.add_argument("--output", required=True, help="Path to the JSON output report.")
    parser.add_argument("--model", required=True, help="Groq model name to evaluate.")
    parser.add_argument(
        "--system-prompt",
        default=DEFAULT_SYSTEM_PROMPT,
        help="Optional system prompt override.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append results to an existing JSON report instead of overwriting it.",
    )
    return parser.parse_args()


def run_evaluation(
    document_path: str,
    tests_path: str,
    output_path: str,
    model: str,
    system_prompt: str | None,
    append: bool = False,
) -> dict[str, Any]:
    """Run the grounding evaluation and write reports."""
    document_text = _load_document(document_path)
    baseline_document_path, baseline_document_text = _load_baseline_document()
    tests = load_tests(tests_path)

    grounded_results: list[dict[str, Any]] = []
    baseline_results: list[dict[str, Any]] = []
    for test in tests:
        grounded_response = generate_response(
            document_text=document_text,
            user_input=test["input"],
            model=model,
            system_prompt=system_prompt,
        )
        grounded_basic_eval = evaluate_output(
            test["expected"], grounded_response["raw_text"]
        )
        grounded_results.append(
            {
                "id": test["id"],
                "input": test["input"],
                "expected": test["expected"],
                "generated_output": grounded_response["raw_text"],
                "raw_response": grounded_response["raw_response"],
                "basic_eval": grounded_basic_eval,
            }
        )

        baseline_response = generate_response(
            document_text=baseline_document_text,
            user_input=test["input"],
            model=model,
            system_prompt=system_prompt,
        )
        baseline_basic_eval = evaluate_output(
            test["expected"], baseline_response["raw_text"]
        )
        baseline_results.append(
            {
                "id": test["id"],
                "input": test["input"],
                "expected": test["expected"],
                "generated_output": baseline_response["raw_text"],
                "raw_response": baseline_response["raw_response"],
                "basic_eval": baseline_basic_eval,
            }
        )

    grounded_report = build_report(
        document_path=document_path,
        model=model,
        run_type="with_document",
        results=grounded_results,
    )
    baseline_report = build_report(
        document_path=baseline_document_path,
        model=model,
        run_type="baseline_document",
        results=baseline_results,
    )
    final_grounded_report = write_json_report(
        grounded_report, output_path=output_path, append=append
    )
    baseline_output_path = _build_baseline_output_path(output_path)
    final_baseline_report = write_json_report(
        baseline_report, output_path=baseline_output_path, append=append
    )
    write_markdown_report(
        final_grounded_report,
        final_baseline_report,
        output_path=output_path,
    )
    return {
        "grounded_report": final_grounded_report,
        "baseline_report": final_baseline_report,
        "baseline_output_path": str(baseline_output_path),
    }


def main() -> int:
    """CLI entrypoint."""
    args = parse_args()
    _load_local_env()
    try:
        run_evaluation(
            document_path=args.doc,
            tests_path=args.tests,
            output_path=args.output,
            model=args.model,
            system_prompt=args.system_prompt,
            append=args.append,
        )
    except (FileNotFoundError, ValueError, GroqClientError) as exc:
        print(f"Error: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
