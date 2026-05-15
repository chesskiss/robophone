from __future__ import annotations

from typing import Any, Protocol

from .models import (
    ConversationResponse,
    ConversationResponseRequest,
    ConversationRouteRequest,
    ConversationRouteResult,
    EmotionResponse,
    EmotionResponseRequest,
    EmotionSignal,
    ManualQaRequest,
    ManualQaResponse,
    SpeechSignal,
)


class EmotionProvider(Protocol):
    def get_latest(self) -> EmotionSignal | None: ...

    def close(self) -> None: ...


class SpeechProvider(Protocol):
    def start(self) -> None: ...

    def get_latest(self) -> SpeechSignal | None: ...

    def stop(self) -> str: ...


class ManualQaProvider(Protocol):
    def answer(self, request: ManualQaRequest) -> ManualQaResponse: ...


class EmotionResponseProvider(Protocol):
    def answer(self, request: EmotionResponseRequest) -> EmotionResponse: ...


class ConversationRouteProvider(Protocol):
    def classify(self, request: ConversationRouteRequest) -> ConversationRouteResult: ...


class ConversationResponseProvider(Protocol):
    def answer(self, request: ConversationResponseRequest) -> ConversationResponse: ...


class MotionProvider(Protocol):
    def detect(self, frame: Any) -> dict[str, Any] | None: ...
