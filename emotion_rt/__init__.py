"""Standalone real-time emotion detection module."""

from .config import EmotionRTConfig
from .provider import EmotionCameraProvider

__all__ = ["EmotionCameraProvider", "EmotionRTConfig"]
