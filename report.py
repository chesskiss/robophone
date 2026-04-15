"""Report generation utilities for Robophone evaluations."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .tests import TestCase


def evaluate_output(test_case: TestCase, generated_output: str) -> dict[str, Any]:
    """Run simple string-based checks against a generated output."""
    matched_must_contain = [
        token for token in test_case.expected.must_contain if token in generated_output
    ]
    violated_must_not_contain = [
        token for token in test_case.expected.must_not_contain if token in generated_output
    ]
    return {
        "must_contain_pass": len(matched_must_contain) == len(test_case.expected.must_contain),
        "must_not_contain_pass": not violated_must_not_contain,
        "matched_must_contain": matched_must_contain,
        "violated_must_not_contain": violated_must_not_contain,
    }


def write_json_report(
    report_data: dict[str, Any],
    output_path: str | Path,
    *,
    append: bool = False,
) -> dict[str, Any]:
    """Write the JSON report to disk, optionally appending to an existing report."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if append and path.exists():
        existing = _load_existing_report(path)
        existing_results = existing.get("results", [])
        if not isinstance(existing_results, list):
            raise ValueError(f"Existing report has a non-list 'results' field: {path}")
        report_data = {**existing, **report_data, "results": existing_results + report_data["results"]}

    path.write_text(json.dumps(report_data, indent=2, ensure_ascii=False), encoding="utf-8")
    return report_data


def write_markdown_report(report_data: dict[str, Any], output_path: str | Path) -> Path:
    """Write a markdown summary report beside the JSON report."""
    json_path = Path(output_path)
    markdown_path = json_path.with_suffix(".md")
    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text(_build_markdown_summary(report_data), encoding="utf-8")
    return markdown_path


def _load_existing_report(path: Path) -> dict[str, Any]:
    try:
        existing = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Existing report is not valid JSON: {path}") from exc
    if not isinstance(existing, dict):
        raise ValueError(f"Existing report must be a JSON object: {path}")
    return existing


def _build_markdown_summary(report_data: dict[str, Any]) -> str:
    lines = [
        "# Robophone Evaluation Report",
        "",
        f"- Document: `{report_data['document_path']}`",
        f"- Model: `{report_data['model']}`",
        f"- Timestamp: `{report_data['timestamp']}`",
    ]
    system_prompt = report_data.get("system_prompt")
    if system_prompt:
        lines.append(f"- System prompt: `{system_prompt}`")
    lines.extend(["", "## Results", ""])

    for result in report_data.get("results", []):
        lines.extend(
            [
                f"### {result['id']}",
                "",
                "**Input**",
                "",
                result["input"],
                "",
                "**Expected**",
                "",
                "```json",
                json.dumps(result["expected"], indent=2, ensure_ascii=False),
                "```",
                "",
                "**Generated Output**",
                "",
                "```text",
                result.get("generated_output", ""),
                "```",
                "",
            ]
        )

    return "\n".join(lines).rstrip() + "\n"
