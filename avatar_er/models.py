from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

ResponsivenessMode = Literal["normal", "low", "silent"]
Tone = Literal["neutral", "encouraging", "technical", "beginner"]
ConversationRole = Literal["teacher", "child", "system"]
ConversationSource = Literal["emotion_prompt", "typed_input", "arg_input", "stt"]
ConversationRoute = Literal["general_conversation", "manual_help"]
IntentType = Literal[
    "settings_command",
    "help_request",
    "explanation_request",
    "manual_block_guidance_request",
    "encouragement_request",
    "unknown",
    "none",
]
ActionType = Literal[
    "none",
    "settings_update",
    "manual_guidance",
    "emotion_check_in",
    "encouragement",
    "emotion_observation",
    "conversation_response",
]


@dataclass(slots=True)
class EmotionSignal:
    emotion: str | None = None
    confidence: float | None = None
    timestamp: float | None = None
    face_bbox: tuple[int, int, int, int] | None = None
    source: str = "unknown"
    source_face_id: str | None = None
    is_stable: bool = True

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "EmotionSignal":
        bbox = payload.get("face_bbox")
        return cls(
            emotion=_clean_optional_str(payload.get("emotion")),
            confidence=_clean_optional_float(payload.get("confidence")),
            timestamp=_clean_optional_float(payload.get("timestamp")),
            face_bbox=_clean_bbox(bbox),
            source=_clean_optional_str(payload.get("source")) or "unknown",
            source_face_id=_clean_optional_str(payload.get("source_face_id")),
            is_stable=bool(payload.get("is_stable", True)),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class SpeechSignal:
    text: str
    timestamp: float | None = None
    source: str = "unknown"

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SpeechSignal":
        text = _clean_optional_str(payload.get("text"))
        if not text:
            raise ValueError("SpeechSignal requires non-empty text.")
        return cls(
            text=text,
            timestamp=_clean_optional_float(payload.get("timestamp")),
            source=_clean_optional_str(payload.get("source")) or "unknown",
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ManualQaRequest:
    question: str
    current_task: str | None
    tone: Tone
    detail_level: str
    context: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ManualQaResponse:
    answer_text: str
    backend: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class EmotionResponseRequest:
    emotion: str
    current_task: str | None
    tone: Tone
    context: dict[str, Any] = field(default_factory=dict)
    recent_emotions: list[dict[str, Any]] = field(default_factory=list)
    recent_speech_texts: list[str] = field(default_factory=list)


@dataclass(slots=True)
class EmotionResponse:
    response_text: str
    backend: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConversationMessage:
    role: ConversationRole
    text: str
    timestamp: float | None = None
    source: ConversationSource = "typed_input"
    route: ConversationRoute | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ConversationRouteRequest:
    user_text: str
    current_task: str | None
    tone: Tone
    context: dict[str, Any] = field(default_factory=dict)
    conversation_history: list[dict[str, Any]] = field(default_factory=list)
    recent_emotions: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class ConversationRouteResult:
    route: ConversationRoute
    backend: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ConversationResponseRequest:
    user_text: str
    current_task: str | None
    tone: Tone
    context: dict[str, Any] = field(default_factory=dict)
    conversation_history: list[dict[str, Any]] = field(default_factory=list)
    recent_emotions: list[dict[str, Any]] = field(default_factory=list)
    latest_emotion: str | None = None


@dataclass(slots=True)
class ConversationResponse:
    response_text: str
    backend: str = "unknown"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class PerceptionInput:
    emotion_signal: EmotionSignal | None = None
    speech_signal: SpeechSignal | None = None
    emotion: str | None = None
    emotion_confidence: float | None = None
    speech_text: str | None = None
    face_id: str | None = None
    gaze: str | None = None
    objects: list[str] = field(default_factory=list)
    current_task: str | None = None
    input_source: ConversationSource = "typed_input"

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "PerceptionInput":
        emotion_signal = _coerce_emotion_signal(payload)
        speech_signal = _coerce_speech_signal(payload)
        return cls(
            emotion_signal=emotion_signal,
            speech_signal=speech_signal,
            emotion=emotion_signal.emotion if emotion_signal else _clean_optional_str(payload.get("emotion")),
            emotion_confidence=(
                emotion_signal.confidence if emotion_signal else _clean_optional_float(payload.get("emotion_confidence"))
            ),
            speech_text=speech_signal.text if speech_signal else _clean_optional_str(payload.get("speech_text")),
            face_id=_clean_optional_str(payload.get("face_id")),
            gaze=_clean_optional_str(payload.get("gaze")),
            objects=_clean_str_list(payload.get("objects")),
            current_task=_clean_optional_str(payload.get("current_task")),
            input_source=_clean_conversation_source(payload.get("input_source")),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class AvatarState:
    responsiveness_mode: ResponsivenessMode = "normal"
    tone: Tone = "encouraging"
    last_response_timestamp: float | None = None
    cooldown_seconds: int = 20
    current_task: str | None = None
    recent_emotions: list[str] = field(default_factory=list)
    recent_emotion_events: list[dict[str, Any]] = field(default_factory=list)
    recent_speech_texts: list[str] = field(default_factory=list)
    recent_user_commands: list[str] = field(default_factory=list)
    conversation_history: list[dict[str, Any]] = field(default_factory=list)
    conversation_active: bool = False
    last_teacher_prompt: str | None = None
    last_route: ConversationRoute | None = None
    last_answered_question: str | None = None
    recent_answered_topics: list[str] = field(default_factory=list)
    last_proactive_emotion: str | None = None
    last_proactive_emotion_timestamp: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class CommandResult:
    handled: bool
    action: str = "none"
    updated_settings: dict[str, Any] = field(default_factory=dict)
    response_text: str | None = None
    command_name: str | None = None


@dataclass(slots=True)
class IntentResult:
    intent: IntentType
    confidence: float
    reason: str


@dataclass(slots=True)
class DecisionResult:
    should_respond: bool
    action_type: ActionType
    reason: str
    response_text: str | None
    updated_state: dict[str, Any]
    payload: dict[str, Any] = field(default_factory=dict)

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "should_speak": self.should_respond,
            "response_text": self.response_text,
            "updated_state": self.updated_state,
            "action_type": self.action_type,
            "reason": self.reason,
            "payload": self.payload,
        }


def _clean_optional_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_str_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [str(value).strip()]


def _clean_bbox(value: Any) -> tuple[int, int, int, int] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        return None
    try:
        return tuple(int(part) for part in value)
    except (TypeError, ValueError):
        return None


def _coerce_emotion_signal(payload: dict[str, Any]) -> EmotionSignal | None:
    nested = payload.get("emotion_signal")
    if isinstance(nested, dict):
        return EmotionSignal.from_dict(nested)

    emotion = _clean_optional_str(payload.get("emotion"))
    if not emotion:
        return None
    return EmotionSignal(
        emotion=emotion,
        confidence=_clean_optional_float(payload.get("emotion_confidence")),
        timestamp=_clean_optional_float(payload.get("timestamp")),
        face_bbox=_clean_bbox(payload.get("face_bbox")),
        source=_clean_optional_str(payload.get("source")) or "legacy_payload",
        source_face_id=_clean_optional_str(payload.get("face_id")),
        is_stable=bool(payload.get("emotion_is_stable", True)),
    )


def _coerce_speech_signal(payload: dict[str, Any]) -> SpeechSignal | None:
    nested = payload.get("speech_signal")
    if isinstance(nested, dict):
        return SpeechSignal.from_dict(nested)

    speech_text = _clean_optional_str(payload.get("speech_text"))
    if not speech_text:
        return None
    return SpeechSignal(
        text=speech_text,
        timestamp=_clean_optional_float(payload.get("speech_timestamp")),
        source=_clean_optional_str(payload.get("speech_source")) or "legacy_payload",
    )


def _clean_conversation_source(value: Any) -> ConversationSource:
    normalized = _clean_optional_str(value)
    if normalized in {"emotion_prompt", "typed_input", "arg_input", "stt"}:
        return normalized
    return "typed_input"
