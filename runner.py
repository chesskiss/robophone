"""CLI entry point for the Robophone grounding evaluation harness."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from typing import Any

from .config import DEFAULT_SYSTEM_PROMPT
from .groq_client import GroqClientError, generate_response
from .report import evaluate_output, write_json_report, write_markdown_report
from .tests import TestCase, TestLoadError, load_tests


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command line arguments for the evaluation harness."""
    parser = argparse.ArgumentParser(description="Evaluate a grounding document against Robophone tests.")
    parser.add_argument("--doc", required=True, help="Path to the grounding document.")
    parser.add_argument("--tests", required=True, help="Path to the JSON tests file.")
    parser.add_argument("--output", required=True, help="Path to the JSON report output.")
    parser.add_argument("--model", required=True, help="Groq model name.")
    parser.add_argument(
        "--system-prompt",
        default=DEFAULT_SYSTEM_PROMPT,
        help="Optional system prompt override. Defaults to the prompt in robophone.config.",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append results to an existing JSON report instead of overwriting it.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Run the evaluation harness from the command line."""
    args = parse_args(argv)

    try:
        document_path = Path(args.doc)
        document_text = _load_document(document_path)
        test_cases = load_tests(args.tests)
        report_data = run_evaluation(
            document_path=document_path,
            document_text=document_text,
            test_cases=test_cases,
            model=args.model,
            system_prompt=args.system_prompt,
        )
        final_report = write_json_report(report_data, args.output, append=args.append)
        markdown_path = write_markdown_report(final_report, args.output)
    except (FileNotFoundError, TestLoadError, GroqClientError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"json_report": args.output, "markdown_report": str(markdown_path)}, indent=2))
    return 0


def run_evaluation(
    *,
    document_path: Path,
    document_text: str,
    test_cases: list[TestCase],
    model: str,
    system_prompt: str | None,
) -> dict[str, Any]:
    """Run the configured tests and build the report payload."""
    results = []
    for test_case in test_cases:
        generation = generate_response(
            document_text=document_text,
            user_input=test_case.input,
            model=model,
            system_prompt=system_prompt,
        )
        generated_output = generation["raw_text"]
        results.append(
            {
                **test_case.to_report_dict(),
                "generated_output": generated_output,
                "raw_response": generation["raw_response"],
                "basic_eval": evaluate_output(test_case, generated_output),
            }
        )

    return {
        "document_path": str(document_path),
        "model": model,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system_prompt": system_prompt,
        "results": results,
    }


def _load_document(path: Path) -> str:
    if not path.is_file():
        raise FileNotFoundError(f"Document file not found: {path}")
    return path.read_text(encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
