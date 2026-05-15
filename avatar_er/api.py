from __future__ import annotations

from .adapters import (
    GeminiConversationResponseProvider,
    GeminiConversationRouteProvider,
    GeminiEmotionResponseProvider,
    GroundEvalManualQaProvider,
)
from .coordinator import AvatarLiveCoordinator
from .decision import AvatarDecisionEngine
from .state import AvatarSessionStore

_DEFAULT_STORE = AvatarSessionStore()
_DEFAULT_ENGINE = AvatarDecisionEngine(
    store=_DEFAULT_STORE,
    manual_qa_provider=GroundEvalManualQaProvider(),
    emotion_response_provider=GeminiEmotionResponseProvider(),
    conversation_route_provider=GeminiConversationRouteProvider(),
    conversation_response_provider=GeminiConversationResponseProvider(),
)


def process_avatar_input(perception_payload: dict) -> dict:
    """Public entry point for external RoboPhone code."""
    return _DEFAULT_ENGINE.process(perception_payload)


def build_live_coordinator(**kwargs) -> AvatarLiveCoordinator:
    return AvatarLiveCoordinator(engine=_DEFAULT_ENGINE, **kwargs)
