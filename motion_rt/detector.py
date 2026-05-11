from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class MotionSignal:
    motion_score: float
    is_motion_detected: bool


class FrameDiffMotionDetector:
    """Small frame-difference detector reserved for later ER integrations."""

    def __init__(self, threshold: float = 12.0) -> None:
        self.threshold = threshold
        self._previous_gray = None

    def detect(self, frame_bgr) -> MotionSignal | None:
        import cv2
        import numpy as np

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        if self._previous_gray is None:
            self._previous_gray = gray
            return None

        diff = cv2.absdiff(self._previous_gray, gray)
        score = float(np.mean(diff))
        self._previous_gray = gray
        return MotionSignal(motion_score=score, is_motion_detected=score >= self.threshold)
