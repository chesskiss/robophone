"""Runtime question-answering surface built on top of ground_eval."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .config import DEFAULT_SYSTEM_PROMPT
from .groq_client import generate_response
from .runner import _load_local_env


@dataclass(slots=True)
class GroundEvalRuntimeRequest:
    question: str
    current_task: str | None = None
    tone: str = "encouraging"
    detail_level: str = "step_by_step"
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class GroundEvalRuntimeResponse:
    answer_text: str
    backend: str
    metadata: dict[str, Any] = field(default_factory=dict)


def _default_document_path() -> str:
    return str(Path(__file__).resolve().parent / "robophone_llm_instructions.md")


class GroundEvalRuntimeService:
    def __init__(
        self,
        document_path: str | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
    ) -> None:
        self.document_path = document_path or _default_document_path()
        self.model = model or os.getenv("GROUND_EVAL_MODEL", "llama-3.3-70b-versatile")
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self._document_text: str | None = None

    def answer(self, request: GroundEvalRuntimeRequest) -> GroundEvalRuntimeResponse:
        _load_local_env()
        prompt = self._build_runtime_prompt(request)
        response = generate_response(
            document_text=self._load_document_text(),
            user_input=prompt,
            model=self.model,
            system_prompt=self.system_prompt,
        )
        return GroundEvalRuntimeResponse(
            answer_text=response["raw_text"],
            backend="robophone.ground_eval",
            metadata={
                "model": self.model,
                "document_path": self.document_path,
            },
        )

    def _load_document_text(self) -> str:
        if self._document_text is None:
            path = Path(self.document_path)
            self._document_text = path.read_text(encoding="utf-8")
        return self._document_text

    def _build_runtime_prompt(self, request: GroundEvalRuntimeRequest) -> str:
        parts = [f"Question: {request.question}"]
        if request.current_task:
            parts.append(f"Current task: {request.current_task}")
        parts.append(f"Tone preference: {request.tone}")
        parts.append(f"Detail level: {request.detail_level}")
        if request.context:
            parts.append(f"ER context: {request.context}")
        parts.append("Answer as guidance for the RoboPhone manual user.")
        return "\n".join(parts)
