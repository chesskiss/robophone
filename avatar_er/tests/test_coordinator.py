from __future__ import annotations

import unittest

from robophone.avatar_er.coordinator import AvatarLiveCoordinator
from robophone.avatar_er.models import EmotionSignal


class StubEngine:
    def evaluate(self, perception):
        class Result:
            def __init__(self, payload):
                self.payload = payload

            def to_public_dict(self):
                return self.payload

        emotion = perception.emotion_signal.emotion if perception.emotion_signal else None
        return Result(
            {
                "should_speak": emotion == "confused",
                "response_text": "help" if emotion == "confused" else None,
                "updated_state": {},
                "action_type": "emotion_check_in",
                "reason": "test",
                "payload": {"emotion": emotion},
            }
        )


class StubEmotionProvider:
    def __init__(self, signals):
        self.signals = list(signals)

    def get_latest(self):
        if self.signals:
            return self.signals.pop(0)
        return None

    def close(self):
        return None


class CoordinatorTests(unittest.TestCase):
    def test_emits_only_on_emotion_change(self) -> None:
        coordinator = AvatarLiveCoordinator(
            engine=StubEngine(),
            emotion_provider=StubEmotionProvider(
                [
                    EmotionSignal(emotion="happy", confidence=0.9, is_stable=True),
                    EmotionSignal(emotion="happy", confidence=0.91, is_stable=True),
                    EmotionSignal(emotion="confused", confidence=0.95, is_stable=True),
                ]
            ),
        )
        first = coordinator.process_next_events()
        second = coordinator.process_next_events()
        third = coordinator.process_next_events()
        self.assertEqual(len(first), 1)
        self.assertEqual(len(second), 0)
        self.assertEqual(len(third), 1)

    def test_does_not_emit_unstable_or_empty_emotion(self) -> None:
        coordinator = AvatarLiveCoordinator(
            engine=StubEngine(),
            emotion_provider=StubEmotionProvider(
                [
                    EmotionSignal(emotion="sad", confidence=0.9, is_stable=False),
                    EmotionSignal(emotion=None, confidence=0.9, is_stable=True),
                    EmotionSignal(emotion="happy", confidence=0.9, is_stable=True),
                ]
            ),
        )
        first = coordinator.process_next_events()
        second = coordinator.process_next_events()
        third = coordinator.process_next_events()
        self.assertEqual(first, [])
        self.assertEqual(second, [])
        self.assertEqual(len(third), 1)


if __name__ == "__main__":
    unittest.main()
