"""Configuration for the grounding evaluation harness."""

DEFAULT_SYSTEM_PROMPT = (
    "Use the provided grounding document as the primary reference. "
    "Answer based only on the document when possible. "
    "Do not invent Robophone blocks or functions that are not supported by the document. "
    "Respond with the best matching Robophone function or block name and a short explanation."
)

