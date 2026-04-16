"""Helpers for loading and validating grounding evaluation tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_tests(tests_path: str | Path) -> list[dict[str, Any]]:
    """Load and minimally validate test definitions from JSON."""
    path = Path(tests_path)
    if not path.exists():
        raise FileNotFoundError(f"Tests file not found: {path}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in tests file: {path}") from exc

    if not isinstance(data, list):
        raise ValueError("Tests file must contain a JSON array.")

    validated: list[dict[str, Any]] = []
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"Test entry at index {index} must be an object.")

        test_id = item.get("id")
        user_input = item.get("input")
        expected = item.get("expected")

        if not isinstance(test_id, str) or not test_id.strip():
            raise ValueError(f"Test entry at index {index} is missing a valid 'id'.")
        if not isinstance(user_input, str):
            raise ValueError(f"Test '{test_id}' is missing a valid 'input'.")
        if not isinstance(expected, dict):
            raise ValueError(f"Test '{test_id}' is missing a valid 'expected' object.")

        must_contain = expected.get("must_contain", [])
        must_not_contain = expected.get("must_not_contain", [])
        notes = expected.get("notes", "")

        if not isinstance(must_contain, list) or not all(
            isinstance(value, str) for value in must_contain
        ):
            raise ValueError(
                f"Test '{test_id}' has an invalid expected.must_contain value."
            )
        if not isinstance(must_not_contain, list) or not all(
            isinstance(value, str) for value in must_not_contain
        ):
            raise ValueError(
                f"Test '{test_id}' has an invalid expected.must_not_contain value."
            )
        if not isinstance(notes, str):
            raise ValueError(f"Test '{test_id}' has an invalid expected.notes value.")

        validated.append(
            {
                "id": test_id,
                "input": user_input,
                "expected": {
                    "must_contain": must_contain,
                    "must_not_contain": must_not_contain,
                    "notes": notes,
                },
            }
        )

    return validated
