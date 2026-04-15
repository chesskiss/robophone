"""Helpers for loading and validating evaluation test cases."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any


class TestLoadError(Exception):
    """Raised when the tests file cannot be loaded or validated."""


@dataclass(frozen=True)
class ExpectedOutput:
    must_contain: list[str]
    must_not_contain: list[str]
    notes: str


@dataclass(frozen=True)
class TestCase:
    id: str
    input: str
    expected: ExpectedOutput

    def to_report_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable representation of the test case."""
        return {
            "id": self.id,
            "input": self.input,
            "expected": {
                "must_contain": self.expected.must_contain,
                "must_not_contain": self.expected.must_not_contain,
                "notes": self.expected.notes,
            },
        }


def load_tests(path: str | Path) -> list[TestCase]:
    """Load and validate test cases from a JSON file."""
    test_path = Path(path)
    if not test_path.is_file():
        raise FileNotFoundError(f"Tests file not found: {test_path}")

    try:
        payload = json.loads(test_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise TestLoadError(f"Invalid JSON in tests file {test_path}: {exc}") from exc

    if not isinstance(payload, list):
        raise TestLoadError(f"Tests file must contain a JSON array: {test_path}")

    cases: list[TestCase] = []
    for index, item in enumerate(payload):
        cases.append(_parse_test_case(item, index=index, source=test_path))
    return cases


def _parse_test_case(item: Any, *, index: int, source: Path) -> TestCase:
    if not isinstance(item, dict):
        raise TestLoadError(f"Test at index {index} in {source} must be a JSON object")

    test_id = item.get("id")
    user_input = item.get("input")
    expected = item.get("expected")

    if not isinstance(test_id, str) or not test_id.strip():
        raise TestLoadError(f"Test at index {index} in {source} is missing a valid 'id'")
    if not isinstance(user_input, str):
        raise TestLoadError(f"Test '{test_id}' in {source} is missing a valid 'input'")
    if not isinstance(expected, dict):
        raise TestLoadError(f"Test '{test_id}' in {source} is missing a valid 'expected' object")

    must_contain = _validate_string_list(expected.get("must_contain"), test_id=test_id, field="must_contain")
    must_not_contain = _validate_string_list(
        expected.get("must_not_contain"), test_id=test_id, field="must_not_contain"
    )
    notes = expected.get("notes", "")
    if not isinstance(notes, str):
        raise TestLoadError(f"Test '{test_id}' has a non-string expected.notes field")

    return TestCase(
        id=test_id,
        input=user_input,
        expected=ExpectedOutput(
            must_contain=must_contain,
            must_not_contain=must_not_contain,
            notes=notes,
        ),
    )


def _validate_string_list(value: Any, *, test_id: str, field: str) -> list[str]:
    if not isinstance(value, list):
        raise TestLoadError(f"Test '{test_id}' has a non-list expected.{field} field")
    if not all(isinstance(entry, str) for entry in value):
        raise TestLoadError(f"Test '{test_id}' expected.{field} must contain only strings")
    return value
