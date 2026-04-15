"""Configuration defaults for the Robophone evaluation harness."""

from __future__ import annotations


DEFAULT_SYSTEM_PROMPT = (
    "Use the provided grounding document as the primary reference. "
    "Answer based only on the document when possible. "
    "Do not invent blocks or functions that are not supported by the document."
)

PROMPT_TEMPLATE = """Grounding document:
{document_text}

User input:
{user_input}
"""
