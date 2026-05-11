from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field

from .models import ManualQaRequest, ManualQaResponse, SpeechSignal
from .providers import ManualQaProvider, SpeechProvider


@dataclass(slots=True)
class GroundEvalManualQaProvider(ManualQaProvider):
    document_path: str | None = None
    model: str | None = None
    system_prompt: str | None = None

    def answer(self, request: ManualQaRequest) -> ManualQaResponse:
        from robophone.ground_eval.runtime import GroundEvalRuntimeRequest, GroundEvalRuntimeService

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
