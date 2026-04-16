"""Reporting helpers for grounding evaluation runs."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def evaluate_output(expected: dict[str, Any], generated_output: str) -> dict[str, Any]:
    """Run simple string-based checks against model output."""
    must_contain = expected.get("must_contain", [])
    must_not_contain = expected.get("must_not_contain", [])

    matched_must_contain = [
        value for value in must_contain if value in generated_output
    ]
    violated_must_not_contain = [
        value for value in must_not_contain if value in generated_output
    ]

    return {
        "must_contain_pass": len(matched_must_contain) == len(must_contain),
        "must_not_contain_pass": len(violated_must_not_contain) == 0,
        "matched_must_contain": matched_must_contain,
        "violated_must_not_contain": violated_must_not_contain,
    }


def build_report(
    document_path: str | None,
    model: str,
    run_type: str,
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    """Create the report payload."""
    return {
        "document_path": document_path,
        "model": model,
        "run_type": run_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }


def write_json_report(
    report_data: dict[str, Any],
    output_path: str | Path,
    append: bool = False,
) -> dict[str, Any]:
    """Write a JSON report, optionally appending results to an existing file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    final_report = report_data
    if append and path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Existing report at {path} is not valid JSON and cannot be appended to."
            ) from exc
        if not isinstance(existing, dict) or not isinstance(existing.get("results"), list):
            raise ValueError(
                f"Existing report at {path} does not have the expected JSON structure."
            )

        existing["document_path"] = report_data["document_path"]
        existing["model"] = report_data["model"]
        existing["timestamp"] = report_data["timestamp"]
        existing["results"].extend(report_data["results"])
        final_report = existing

    path.write_text(json.dumps(final_report, indent=2, ensure_ascii=False), encoding="utf-8")
    return final_report


def write_markdown_report(
    grounded_report: dict[str, Any],
    baseline_report: dict[str, Any],
    output_path: str | Path,
) -> Path:
    """Write a Markdown summary beside the JSON report."""
    json_path = Path(output_path)
    md_path = json_path.with_suffix(".md")

    baseline_results = baseline_report.get("results", [])
    lines = [
        "# Grounding Evaluation Report",
        "",
        f"- Document: `{grounded_report['document_path']}`",
        f"- Model: `{grounded_report['model']}`",
        f"- Timestamp: `{grounded_report['timestamp']}`",
        f"- Baseline Document: `{baseline_report['document_path']}`",
        f"- Baseline JSON: `{json_path.with_name(json_path.stem + '_baseline.json')}`",
        "",
    ]

    for index, result in enumerate(grounded_report["results"]):
        expected = result["expected"]
        baseline_result = baseline_results[index] if index < len(baseline_results) else {}
        lines.extend(
            [
                f"## {result['id']}",
                "",
                "**Input**",
                "",
                result["input"],
                "",
                "**Expected**",
                "",
                f"- must_contain: {expected.get('must_contain', [])}",
                f"- must_not_contain: {expected.get('must_not_contain', [])}",
                f"- notes: {expected.get('notes', '')}",
                "",
                "**Generated Output With Document**",
                "",
                "```text",
                result.get("generated_output", ""),
                "```",
                "",
                "**Generated Output With Baseline Document**",
                "",
                "```text",
                baseline_result.get("generated_output", ""),
                "```",
                "",
            ]
        )

    md_path.write_text("\n".join(lines), encoding="utf-8")
    return md_path
