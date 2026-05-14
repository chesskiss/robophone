from __future__ import annotations

from dataclasses import replace

from .models import AvatarState, EmotionSignal


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

    def _trim_history(self) -> None:
        self._state.recent_emotions = self._state.recent_emotions[-self._history_limit :]
        self._state.recent_emotion_events = self._state.recent_emotion_events[-self._history_limit :]
        self._state.recent_speech_texts = self._state.recent_speech_texts[-self._history_limit :]
        self._state.recent_user_commands = self._state.recent_user_commands[-self._history_limit :]
