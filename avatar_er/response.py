from __future__ import annotations

from .models import ResponsivenessMode, Tone


def format_spoken_response(
    text: str | None,
    mode: ResponsivenessMode,
    tone: Tone,
    should_speak: bool,
    allow_silent_mode_speech: bool = False,
) -> str | None:
    if not should_speak or not text:
        return None
    if mode == "silent" and not allow_silent_mode_speech:
        return None

    base_text = text.strip()
    if mode == "low":
        base_text = _shorten(base_text)
    return _apply_tone(base_text, tone)


def _apply_tone(text: str, tone: Tone) -> str:
    if tone == "beginner" and not text.lower().startswith("no problem"):
        return f"No problem. {text}"
    if tone == "encouraging" and not text.lower().startswith("you're"):
        return f"You're doing fine. {text}"
    return text


def _shorten(text: str, max_length: int = 140) -> str:
    sentences = _split_sentences(text)
    if len(sentences) >= 2 and len(sentences[0]) < 28:
        candidate = f"{sentences[0]} {sentences[1]}".strip()
        if len(candidate) <= max_length:
            return candidate
    if sentences:
        first = sentences[0]
        if len(first) <= max_length:
            return first
    if len(text) <= max_length:
        return text
    return text[: max_length - 3].rstrip() + "..."


def _split_sentences(text: str) -> list[str]:
    normalized = text.replace("? ", "?\n").replace("! ", "!\n").replace(". ", ".\n")
    return [segment.strip() for segment in normalized.splitlines() if segment.strip()]
