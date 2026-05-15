from __future__ import annotations

import json
from dataclasses import asdict, replace
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Callable

from .models import AvatarState, ConversationMessage, EmotionSignal


class AvatarSessionStore:
    """In-memory session state with small bounded history."""

    def __init__(self, initial_state: AvatarState | None = None, history_limit: int = 8):
        self._state = initial_state or AvatarState()
        self._history_limit = history_limit

    def get_state(self) -> AvatarState:
        return replace(self._state)

    def set_state(self, state: AvatarState) -> AvatarState:
        self._state = replace(state)
        self._trim_history()
        return self.get_state()

    def update_task(self, current_task: str | None) -> None:
        if current_task:
            self._state.current_task = current_task

    def record_emotion(self, emotion: str | None) -> None:
        if not emotion:
            return
        self._state.recent_emotions.append(emotion)
        self._trim_history()

    def record_emotion_signal(self, signal: EmotionSignal | None) -> None:
        if signal is None or not signal.emotion:
            return
        self._state.recent_emotion_events.append(
            {
                "emotion": signal.emotion,
                "confidence": signal.confidence,
                "timestamp": signal.timestamp,
                "is_stable": signal.is_stable,
            }
        )
        self._trim_history()

    def record_speech(self, text: str | None) -> None:
        if not text:
            return
        self._state.recent_speech_texts.append(text)
        self._trim_history()

    def record_command(self, command: str | None) -> None:
        if not command:
            return
        self._state.recent_user_commands.append(command)
        self._trim_history()

    def add_conversation_message(self, message: ConversationMessage) -> None:
        self._state.conversation_history.append(message.to_dict())
        if message.role == "teacher":
            self._state.last_teacher_prompt = message.text
        if message.route is not None:
            self._state.last_route = message.route
        self._trim_history()

    def set_conversation_active(self, active: bool) -> None:
        self._state.conversation_active = active

    def record_answered_topic(self, topic: str | None) -> None:
        if not topic:
            return
        self._state.recent_answered_topics.append(topic)
        self._trim_history()

    def record_proactive_emotion(self, emotion: str | None, timestamp: float | None) -> None:
        self._state.last_proactive_emotion = emotion
        self._state.last_proactive_emotion_timestamp = timestamp

    def record_turn_timing(
        self,
        *,
        user_turn_timestamp: float | None = None,
        proactive_turn_timestamp: float | None = None,
        stable_emotion_timestamp: float | None = None,
        stable_emotion_value: str | None = None,
        stable_emotion_acknowledged: str | None = None,
        effective_cooldown_until: float | None = None,
    ) -> None:
        if user_turn_timestamp is not None:
            self._state.last_user_turn_timestamp = user_turn_timestamp
        if proactive_turn_timestamp is not None:
            self._state.last_proactive_turn_timestamp = proactive_turn_timestamp
        if stable_emotion_timestamp is not None:
            self._state.last_stable_emotion_timestamp = stable_emotion_timestamp
        if stable_emotion_value is not None:
            self._state.last_stable_emotion_value = stable_emotion_value
        if stable_emotion_acknowledged is not None:
            self._state.last_stable_emotion_acknowledged = stable_emotion_acknowledged
        if effective_cooldown_until is not None:
            self._state.effective_cooldown_until = effective_cooldown_until

    def enqueue_child_input(self, message: ConversationMessage) -> None:
        self._state.pending_child_inputs.append(message.to_dict())
        self._trim_history()

    def pop_pending_child_inputs(self) -> list[dict]:
        items = list(self._state.pending_child_inputs)
        self._state.pending_child_inputs = []
        return items

    def _trim_history(self) -> None:
        self._state.recent_emotions = self._state.recent_emotions[-self._history_limit :]
        self._state.recent_emotion_events = self._state.recent_emotion_events[-self._history_limit :]
        self._state.recent_speech_texts = self._state.recent_speech_texts[-self._history_limit :]
        self._state.recent_user_commands = self._state.recent_user_commands[-self._history_limit :]
        self._state.conversation_history = self._state.conversation_history[-self._history_limit :]
        self._state.recent_answered_topics = self._state.recent_answered_topics[-self._history_limit :]
        self._state.pending_child_inputs = self._state.pending_child_inputs[-self._history_limit :]


class JsonAvatarSessionStore(AvatarSessionStore):
    """Shared JSON-backed session state for local multi-process demos."""

    def __init__(
        self,
        session_path: str | Path,
        initial_state: AvatarState | None = None,
        history_limit: int = 8,
    ):
        self._session_path = Path(session_path)
        self._session_path.parent.mkdir(parents=True, exist_ok=True)
        self._history_limit = history_limit
        self._state = self._load_state(initial_state or AvatarState())
        self._trim_history()
        self._write_state(self._state)

    def get_state(self) -> AvatarState:
        self.refresh()
        return replace(self._state)

    def set_state(self, state: AvatarState) -> AvatarState:
        self._update_state(lambda current: replace(state))
        return self.get_state()

    def update_task(self, current_task: str | None) -> None:
        if not current_task:
            return
        self._update_state(lambda state: self._set_attr(state, "current_task", current_task))

    def record_emotion(self, emotion: str | None) -> None:
        if not emotion:
            return
        self._update_state(lambda state: self._append_list(state, "recent_emotions", emotion))

    def record_emotion_signal(self, signal: EmotionSignal | None) -> None:
        if signal is None or not signal.emotion:
            return
        payload = {
            "emotion": signal.emotion,
            "confidence": signal.confidence,
            "timestamp": signal.timestamp,
            "is_stable": signal.is_stable,
        }
        self._update_state(lambda state: self._append_list(state, "recent_emotion_events", payload))

    def record_speech(self, text: str | None) -> None:
        if not text:
            return
        self._update_state(lambda state: self._append_list(state, "recent_speech_texts", text))

    def record_command(self, command: str | None) -> None:
        if not command:
            return
        self._update_state(lambda state: self._append_list(state, "recent_user_commands", command))

    def add_conversation_message(self, message: ConversationMessage) -> None:
        def mutate(state: AvatarState) -> AvatarState:
            updated = self._append_list(state, "conversation_history", message.to_dict())
            if message.role == "teacher":
                updated = self._set_attr(updated, "last_teacher_prompt", message.text)
            if message.route is not None:
                updated = self._set_attr(updated, "last_route", message.route)
            return updated

        self._update_state(mutate)

    def set_conversation_active(self, active: bool) -> None:
        self._update_state(lambda state: self._set_attr(state, "conversation_active", active))

    def record_answered_topic(self, topic: str | None) -> None:
        if not topic:
            return
        self._update_state(lambda state: self._append_list(state, "recent_answered_topics", topic))

    def record_proactive_emotion(self, emotion: str | None, timestamp: float | None) -> None:
        def mutate(state: AvatarState) -> AvatarState:
            updated = self._set_attr(state, "last_proactive_emotion", emotion)
            return self._set_attr(updated, "last_proactive_emotion_timestamp", timestamp)

        self._update_state(mutate)

    def refresh(self) -> AvatarState:
        self._state = self._load_state(AvatarState())
        self._trim_history()
        return self.get_state_no_refresh()

    def get_state_no_refresh(self) -> AvatarState:
        return replace(self._state)

    def _update_state(self, mutate: Callable[[AvatarState], AvatarState]) -> None:
        current = self._load_state(AvatarState())
        mutated = mutate(current)
        self._state = replace(mutated)
        self._trim_history()
        self._write_state(self._state)

    def enqueue_child_input(self, message: ConversationMessage) -> None:
        self._update_state(lambda state: self._append_list(state, "pending_child_inputs", message.to_dict()))

    def pop_pending_child_inputs(self) -> list[dict]:
        current = self._load_state(AvatarState())
        items = list(current.pending_child_inputs)
        current.pending_child_inputs = []
        self._state = replace(current)
        self._trim_history()
        self._write_state(self._state)
        return items

    def _load_state(self, default_state: AvatarState) -> AvatarState:
        if not self._session_path.exists():
            return replace(default_state)
        try:
            payload = json.loads(self._session_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Corrupted ER session file at {self._session_path}: {exc}") from exc
        if not isinstance(payload, dict):
            raise RuntimeError(f"Invalid ER session file at {self._session_path}: expected JSON object.")
        return AvatarState(**payload)

    def _write_state(self, state: AvatarState) -> None:
        serialized = json.dumps(asdict(state), indent=2, sort_keys=True)
        with NamedTemporaryFile("w", encoding="utf-8", dir=self._session_path.parent, delete=False) as tmp:
            tmp.write(serialized)
            tmp.flush()
            temp_path = Path(tmp.name)
        temp_path.replace(self._session_path)

    def _append_list(self, state: AvatarState, field_name: str, value) -> AvatarState:
        items = list(getattr(state, field_name))
        items.append(value)
        updated = replace(state, **{field_name: items})
        self._state = updated
        self._trim_history()
        return replace(self._state)

    @staticmethod
    def _set_attr(state: AvatarState, field_name: str, value) -> AvatarState:
        return replace(state, **{field_name: value})
