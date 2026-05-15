from __future__ import annotations

import unittest

from robophone.emotion_rt.backends import MockEmotionBackend
from robophone.emotion_rt.config import EmotionRTConfig


class FakeCamera:
    def __init__(self, frames) -> None:
        self.frames = list(frames)

    def read(self):
        if self.frames:
            return True, self.frames.pop(0)
        return False, None

    def release(self) -> None:
        return None


class FakeFaceBox:
    def __init__(self, bbox_xyxy, confidence=1.0) -> None:
        self.bbox_xyxy = bbox_xyxy
        self.confidence = confidence


class FakeFaceRefiner:
    def __init__(self, detections) -> None:
        self.detections = list(detections)

    def detect_face(self, frame):
        if self.detections:
            return self.detections.pop(0)
        return None

    def close(self) -> None:
        return None


class SequenceEmotionBackend:
    def __init__(self, predictions) -> None:
        self.predictions = list(predictions)

    def predict(self, face_crop):
        if not self.predictions:
            raise RuntimeError("No predictions left.")
        return self.predictions.pop(0)


class EmotionProviderTests(unittest.TestCase):
    def test_stability_requires_majority_vote(self) -> None:
        import numpy as np

        from robophone.emotion_rt.provider import EmotionCameraProvider

        provider = EmotionCameraProvider.__new__(EmotionCameraProvider)
        provider.config = EmotionRTConfig(stability_window=5, min_stable_count=3, confidence_threshold=0.55)
        provider.backend = MockEmotionBackend(emotion="happy", confidence=0.9)
        provider._camera = FakeCamera([np.ones((10, 10, 3), dtype="uint8") for _ in range(3)])
        provider._face_refiner = FakeFaceRefiner([FakeFaceBox((0, 0, 5, 5)) for _ in range(3)])
        from collections import deque

        provider._history = deque(maxlen=provider.config.stability_window)

        first = provider.get_latest()
        second = provider.get_latest()
        third = provider.get_latest()
        self.assertIsNotNone(first)
        self.assertFalse(first.is_stable)
        self.assertFalse(second.is_stable)
        self.assertTrue(third.is_stable)

    def test_majority_sadness_survives_intermittent_neutral_noise(self) -> None:
        import numpy as np

        from robophone.emotion_rt.backends import EmotionPrediction
        from robophone.emotion_rt.provider import EmotionCameraProvider

        provider = EmotionCameraProvider.__new__(EmotionCameraProvider)
        provider.config = EmotionRTConfig(stability_window=3, min_stable_count=2, confidence_threshold=0.55)
        provider.backend = SequenceEmotionBackend(
            [
                EmotionPrediction(emotion="sad", confidence=0.9, logits=[0.9]),
                EmotionPrediction(emotion="sad", confidence=0.88, logits=[0.88]),
                EmotionPrediction(emotion="neutral", confidence=0.8, logits=[0.8]),
            ]
        )
        provider._camera = FakeCamera([np.ones((10, 10, 3), dtype="uint8") for _ in range(3)])
        provider._face_refiner = FakeFaceRefiner([FakeFaceBox((0, 0, 5, 5)) for _ in range(3)])
        from collections import deque

        provider._history = deque(maxlen=provider.config.stability_window)

        provider.get_latest()
        provider.get_latest()
        third = provider.get_latest()

        self.assertIsNotNone(third)
        self.assertTrue(third.is_stable)
        self.assertEqual(third.emotion, "sad")


if __name__ == "__main__":
    unittest.main()
