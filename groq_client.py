"""Thin Groq API wrapper for the Robophone evaluation harness."""

from __future__ import annotations

import json
import os
from typing import Any

from .config import PROMPT_TEMPLATE


class GroqClientError(Exception):
    """Raised when the Groq client is misconfigured or a request fails."""


def generate_response(
    document_text: str,
    user_input: str,
    model: str,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """Generate a response from Groq using the grounding document and user input."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise GroqClientError("Missing GROQ_API_KEY environment variable")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append(
        {
            "role": "user",
            "content": PROMPT_TEMPLATE.format(document_text=document_text, user_input=user_input),
        }
    )

    try:
        from groq import Groq
    except ImportError as exc:
        raise GroqClientError(
            "The Groq Python SDK is not installed. Install it with `pip install groq`."
        ) from exc

    client = Groq(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
        )
    except Exception as exc:  # pragma: no cover - depends on external API
        raise GroqClientError(f"Groq API request failed: {exc}") from exc

    raw_payload = _to_serializable(response)
    raw_text = _extract_text(response)
    return {
        "raw_text": raw_text,
        "raw_response": raw_payload,
    }


def _extract_text(response: Any) -> str:
    choices = getattr(response, "choices", None)
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    parts.append(text)
        return "\n".join(parts)
    return str(content)


def _to_serializable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _to_serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_serializable(item) for item in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _to_serializable(model_dump())
    dict_method = getattr(value, "dict", None)
    if callable(dict_method):
        return _to_serializable(dict_method())
    if hasattr(value, "__dict__"):
        return _to_serializable(vars(value))
    try:
        json.dumps(value)
    except TypeError:
        return repr(value)
    return value
