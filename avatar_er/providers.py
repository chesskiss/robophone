from __future__ import annotations

from typing import Any, Protocol

from .models import EmotionSignal, ManualQaRequest, ManualQaResponse, SpeechSignal


class EmotionProvider(Protocol):
    def get_latest(self) -> EmotionSignal | None: ...

    def close(self) -> None: ...


class SpeechProvider(Protocol):
    def start(self) -> None: ...

    def get_latest(self) -> SpeechSignal | None: ...

    def stop(self) -> str: ...


class ManualQaProvider(Protocol):
    def answer(self, request: ManualQaRequest) -> ManualQaResponse: ...


class MotionProvider(Protocol):
    def detect(self, frame: Any) -> dict[str, Any] | None: ...
