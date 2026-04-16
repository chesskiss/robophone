"""Thin Groq client wrapper for grounding evaluation runs."""

from __future__ import annotations

import json
import os
from typing import Any


class GroqClientError(RuntimeError):
    """Raised when the Groq client cannot be used successfully."""


def _serialize_raw_response(response: Any) -> Any:
    """Convert SDK response objects into JSON-serializable data when possible."""
    if response is None:
        return None
    if hasattr(response, "model_dump"):
        return response.model_dump()
    if hasattr(response, "dict"):
        return response.dict()
    if isinstance(response, (dict, list, str, int, float, bool)):
        return response
    try:
        json.dumps(response)
        return response
    except TypeError:
        return {"repr": repr(response)}


def generate_response(
    document_text: str | None,
    user_input: str,
    model: str,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """Send grounding document and user input to Groq and return raw output."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqClientError("Missing GROQ_API_KEY environment variable.")

    try:
        from groq import Groq
    except ImportError as exc:
        raise GroqClientError(
            "The Groq Python SDK is not installed. Install dependencies with 'uv sync' in robophone/."
        ) from exc

    client = Groq(api_key=api_key)
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    if document_text:
        user_message = (
            "Grounding document:\n"
            f"{document_text}\n\n"
            "User input:\n"
            f"{user_input}\n\n"
            "Return the best matching Robophone function or block based on the document."
        )
    else:
        user_message = (
            "User input:\n"
            f"{user_input}\n\n"
            "Return the best matching Robophone function (based on robo-phone.com) or block."
        )
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
        )
    except Exception as exc:  # pragma: no cover - SDK-specific failure shapes vary.
        raise GroqClientError(f"Groq API request failed: {exc}") from exc

    raw_text = ""
    try:
        raw_text = response.choices[0].message.content or ""
    except Exception:
        raw_text = ""

    return {
        "raw_text": raw_text,
        "raw_response": _serialize_raw_response(response),
    }
