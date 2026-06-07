from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def read_avatar_display_state(session_path: str | Path) -> dict[str, Any]:
    """Read the ER shared session and return a UI-focused, read-only snapshot."""
    path = Path(session_path)
    if not path.exists():
        return _idle_state(status="waiting", error=None)

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return _idle_state(
            status="error",
            error=f"Corrupted ER session JSON: {exc}",
        )
    except OSError as exc:
        return _idle_state(
            status="error",
            error=f"Could not read ER session: {exc}",
        )

    if not isinstance(payload, dict):
        return _idle_state(status="error", error="Invalid ER session: expected a JSON object.")

    emotion_event = _latest_stable_emotion_event(payload)
    teacher_message = _latest_message(payload, role="teacher")
    child_message = _latest_message(payload, role="child")

    status = "ready" if teacher_message or emotion_event else "idle"
    return {
        "status": status,
        "error": None,
        "session_path": str(path),
        "emotion": emotion_event.get("emotion") if emotion_event else None,
        "emotion_confidence": emotion_event.get("confidence") if emotion_event else None,
        "emotion_timestamp": emotion_event.get("timestamp") if emotion_event else None,
        "teacher_message": teacher_message,
        "child_message": child_message,
        "conversation_active": bool(payload.get("conversation_active", False)),
        "last_route": payload.get("last_route"),
        "last_teacher_prompt": payload.get("last_teacher_prompt"),
    }


def _idle_state(status: str, error: str | None) -> dict[str, Any]:
    return {
        "status": status,
        "error": error,
        "session_path": None,
        "emotion": None,
        "emotion_confidence": None,
        "emotion_timestamp": None,
        "teacher_message": None,
        "child_message": None,
        "conversation_active": False,
        "last_route": None,
        "last_teacher_prompt": None,
    }


def _latest_stable_emotion_event(payload: dict[str, Any]) -> dict[str, Any] | None:
    events = payload.get("recent_emotion_events", [])
    if not isinstance(events, list):
        return None
    for event in reversed(events):
        if not isinstance(event, dict):
            continue
        if event.get("emotion") and event.get("is_stable", False):
            return event
    return None


def _latest_message(payload: dict[str, Any], role: str) -> dict[str, Any] | None:
    history = payload.get("conversation_history", [])
    if not isinstance(history, list):
        return None
    for message in reversed(history):
        if not isinstance(message, dict):
            continue
        if message.get("role") == role and message.get("text"):
            return {
                "role": message.get("role"),
                "text": message.get("text"),
                "timestamp": message.get("timestamp"),
                "source": message.get("source"),
                "route": message.get("route"),
            }
    return None

