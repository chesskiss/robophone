from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

from .models import (
    ConversationResponse,
    ConversationResponseRequest,
    ConversationRouteRequest,
    ConversationRouteResult,
    EmotionResponse,
    EmotionResponseRequest,
    ManualQaRequest,
    ManualQaResponse,
    SpeechSignal,
)
from .providers import (
    ConversationResponseProvider,
    ConversationRouteProvider,
    EmotionResponseProvider,
    ManualQaProvider,
    SpeechProvider,
)


@dataclass(slots=True)
class GroundEvalManualQaProvider(ManualQaProvider):
    document_path: str | None = None
    model: str | None = None
    system_prompt: str | None = None

    def answer(self, request: ManualQaRequest) -> ManualQaResponse:
        try:
            from robophone.ground_eval.runtime import GroundEvalRuntimeRequest, GroundEvalRuntimeService
        except ImportError:  # pragma: no cover - support running from inside robophone/
            from ground_eval.runtime import GroundEvalRuntimeRequest, GroundEvalRuntimeService

        service = GroundEvalRuntimeService(
            document_path=self.document_path,
            model=self.model,
            system_prompt=self.system_prompt,
        )
        response = service.answer(
            GroundEvalRuntimeRequest(
                question=request.question,
                current_task=request.current_task,
                tone=request.tone,
                detail_level=request.detail_level,
                context=request.context,
            )
        )
        return ManualQaResponse(
            answer_text=response.answer_text,
            backend=response.backend,
            metadata=response.metadata,
        )


@dataclass(slots=True)
class STTSpeechProvider(SpeechProvider):
    api_url: str = "http://localhost:8001/transcribe"
    language: str | None = "en"
    _buffer: deque[SpeechSignal] = field(default_factory=deque, init=False)
    _client: object | None = field(default=None, init=False)

    def start(self) -> None:
        if self._client is not None:
            return
        from robophone.stt.stt import STTClient

        def on_transcription(text: str) -> None:
            self._buffer.append(
                SpeechSignal(
                    text=text,
                    timestamp=time.time(),
                    source="robophone.stt",
                )
            )

        self._client = STTClient(
            on_transcription=on_transcription,
            api_url=self.api_url,
            language=self.language,
        )
        self._client.start()

    def get_latest(self) -> SpeechSignal | None:
        if not self._buffer:
            return None
        latest = self._buffer[-1]
        self._buffer.clear()
        return latest

    def stop(self) -> str:
        if self._client is None:
            return ""
        client = self._client
        self._client = None
        return client.stop()


@dataclass(slots=True)
class GeminiEmotionResponseProvider(EmotionResponseProvider):
    model: str = "gemini-3-flash-preview"
    api_key: str | None = None

    def answer(self, request: EmotionResponseRequest) -> EmotionResponse:
        client = _build_gemini_client(self.api_key)
        prompt = self._build_prompt(request)
        response = client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        text = getattr(response, "text", "") or ""
        return EmotionResponse(
            response_text=text.strip(),
            backend="gemini",
            metadata={"model": self.model},
        )

    def _build_prompt(self, request: EmotionResponseRequest) -> str:
        return (
            "You are a RoboPhone classroom teacher assistant. "
            "Respond in 1-2 short sentences for a student based on their current facial emotion. "
            "Stay task-focused, supportive, and instructional. "
            "Do not sound like a therapist. "
            "Do not mention confidence scores or say you are detecting emotions. "
            f"Current task: {request.current_task or 'unspecified RoboPhone task'}.\n"
            f"Current emotion: {request.emotion}.\n"
            f"Recent emotion history: {request.recent_emotions}.\n"
            f"Recent speech snippets: {request.recent_speech_texts}.\n"
            f"Additional context: {request.context}.\n"
            "Return only the teacher response text."
        )


@dataclass(slots=True)
class GeminiConversationRouteProvider(ConversationRouteProvider):
    model: str = "gemini-3-flash-preview"
    api_key: str | None = None

    def classify(self, request: ConversationRouteRequest) -> ConversationRouteResult:
        client = _build_gemini_client(self.api_key)
        response = client.models.generate_content(
            model=self.model,
            contents=self._build_prompt(request),
        )
        text = ((getattr(response, "text", "") or "").strip().lower())
        route = "manual_help" if "manual_help" in text else "general_conversation"
        return ConversationRouteResult(
            route=route,
            backend="gemini",
            metadata={"model": self.model, "raw_text": text},
        )

    def _build_prompt(self, request: ConversationRouteRequest) -> str:
        return (
            "You are a classifier for a RoboPhone classroom teacher assistant. "
            "Decide whether the child's latest message is asking for RoboPhone task help or is general conversation. "
            "Return only one label: manual_help or general_conversation.\n"
            f"Current task: {request.current_task or 'unspecified RoboPhone task'}.\n"
            f"Latest child message: {request.user_text}\n"
            f"Recent conversation history: {request.conversation_history}\n"
            f"Recent emotion history: {request.recent_emotions}\n"
            f"Additional context: {request.context}\n"
        )


@dataclass(slots=True)
class GeminiConversationResponseProvider(ConversationResponseProvider):
    model: str = "gemini-3-flash-preview"
    api_key: str | None = None

    def answer(self, request: ConversationResponseRequest) -> ConversationResponse:
        client = _build_gemini_client(self.api_key)
        response = client.models.generate_content(
            model=self.model,
            contents=self._build_prompt(request),
        )
        text = getattr(response, "text", "") or ""
        return ConversationResponse(
            response_text=text.strip(),
            backend="gemini",
            metadata={"model": self.model},
        )

    def _build_prompt(self, request: ConversationResponseRequest) -> str:
        return (
            "You are a RoboPhone classroom teacher assistant having a short conversation with a child. "
            "Reply in 1-3 short sentences. Stay calm, supportive, and teacher-like. "
            "Do not sound like a therapist. "
            "If the child is emotional, acknowledge it briefly and guide them constructively. "
            "If the child is asking a general question, answer simply without pretending to have manual-specific facts. "
            f"Current task: {request.current_task or 'unspecified RoboPhone task'}.\n"
            f"Latest detected emotion: {request.latest_emotion or 'unknown'}.\n"
            f"Recent emotion history: {request.recent_emotions}.\n"
            f"Recent conversation history: {request.conversation_history}.\n"
            f"Additional context: {request.context}.\n"
            f"Latest child message: {request.user_text}\n"
            "Return only the teacher response text."
        )


def _build_gemini_client(api_key_override: str | None) -> object:
    try:
        from google import genai
    except ImportError as exc:
        raise RuntimeError(
            "Gemini features require `google-genai`. "
            "Install project dependencies with uv sync."
        ) from exc

    api_key = api_key_override or _get_project_env_value("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY for Gemini features in robophone/.env or the shell.")
    return genai.Client(api_key=api_key)


def _get_project_env_value(key: str) -> str | None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return None
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != key:
            continue
        cleaned = value.strip().strip("'").strip('"')
        return cleaned or None
    return None
