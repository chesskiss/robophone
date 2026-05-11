from __future__ import annotations

from .commands import interpret_command
from .models import AvatarState, IntentResult


def classify_intent(text: str | None, state: AvatarState | None = None) -> IntentResult:
    if not text or not text.strip():
        return IntentResult(intent="none", confidence=1.0, reason="No speech text provided")

    normalized = " ".join(text.lower().strip().split())
    state = state or AvatarState()

    if interpret_command(normalized, state).handled:
        return IntentResult(intent="settings_command", confidence=0.99, reason="Matched control phrase")

    if _contains_any(
        normalized,
        [
            "what does this block do",
            "what does this do",
            "explain this block",
            "what is this block",
        ],
    ):
        return IntentResult(intent="explanation_request", confidence=0.92, reason="Asked to explain a block")

    if _contains_any(
        normalized,
        [
            "how do i",
            "how can i",
            "graph sin",
            "graph cos",
            "display text",
            "lcd",
            "blockly",
            "which block",
            "what block",
        ],
    ):
        return IntentResult(
            intent="manual_block_guidance_request",
            confidence=0.88,
            reason="Asked for RoboPhone or Blockly guidance",
        )

    if _contains_any(
        normalized,
        [
            "i don't understand",
            "i do not understand",
            "help me",
            "i'm stuck",
            "im stuck",
            "confused",
            "can you help",
        ],
    ):
        return IntentResult(intent="help_request", confidence=0.9, reason="Asked for help")

    if _contains_any(
        normalized,
        [
            "am i doing okay",
            "am i doing ok",
            "am i doing good",
            "am i on the right track",
            "can i do this",
        ],
    ):
        return IntentResult(intent="encouragement_request", confidence=0.87, reason="Asked for encouragement")

    return IntentResult(intent="unknown", confidence=0.3, reason="No rule matched")


def _contains_any(text: str, patterns: list[str]) -> bool:
    return any(pattern in text for pattern in patterns)
