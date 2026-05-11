"""FastAPI runtime app for live grounded RoboPhone Q&A."""

from __future__ import annotations

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field
except ImportError:  # pragma: no cover
    FastAPI = None
    HTTPException = RuntimeError
    BaseModel = object
    Field = lambda *args, **kwargs: None

from .runtime import GroundEvalRuntimeRequest, GroundEvalRuntimeService


if FastAPI is not None:
    class RuntimeQuestionRequest(BaseModel):
        question: str = Field(min_length=1)
        current_task: str | None = None
        tone: str = "encouraging"
        detail_level: str = "step_by_step"
        context: dict = Field(default_factory=dict)


    class RuntimeQuestionResponse(BaseModel):
        answer_text: str
        backend: str
        metadata: dict = Field(default_factory=dict)


    application = FastAPI(title="Robophone Ground Eval Runtime", version="0.2.0")
    _SERVICE = GroundEvalRuntimeService()


    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}


    @application.post("/v1/runtime/answer", response_model=RuntimeQuestionResponse)
    def answer_question(request: RuntimeQuestionRequest) -> RuntimeQuestionResponse:
        try:
            response = _SERVICE.answer(
                GroundEvalRuntimeRequest(
                    question=request.question,
                    current_task=request.current_task,
                    tone=request.tone,
                    detail_level=request.detail_level,
                    context=request.context,
                )
            )
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return RuntimeQuestionResponse(
            answer_text=response.answer_text,
            backend=response.backend,
            metadata=response.metadata,
        )
else:  # pragma: no cover
    application = None
