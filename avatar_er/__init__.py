"""ER-style avatar decision layer for RoboPhone."""

from .api import process_avatar_input
from .coordinator import AvatarLiveCoordinator
from .decision import AvatarDecisionEngine
from .models import EmotionSignal, ManualQaRequest, ManualQaResponse, SpeechSignal
from .state import AvatarSessionStore

__all__ = [
    "AvatarDecisionEngine",
    "AvatarLiveCoordinator",
    "AvatarSessionStore",
    "EmotionSignal",
    "ManualQaRequest",
    "ManualQaResponse",
    "SpeechSignal",
    "process_avatar_input",
]
