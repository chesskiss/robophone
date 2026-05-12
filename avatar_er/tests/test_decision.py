from __future__ import annotations

import unittest

from robophone.avatar_er.decision import AvatarDecisionEngine
from robophone.avatar_er.models import ManualQaRequest, ManualQaResponse
from robophone.avatar_er.state import AvatarSessionStore


class MockManualQaProvider:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def answer(self, request: ManualQaRequest) -> ManualQaResponse:
        self.calls.append(
            {
                "user_request": request.question,
                "current_task": request.current_task,
                "perception_context": request.context,
                "tone": request.tone,
                "detail_level": request.detail_level,
            }
        )
        return ManualQaResponse(answer_text="Start with the graph block, then connect sine input.")


class FakeClock:
    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class DecisionEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = FakeClock()
        self.manual = MockManualQaProvider()
        self.engine = AvatarDecisionEngine(
            store=AvatarSessionStore(),
            manual_qa_provider=self.manual,
            clock=self.clock,
        )

    def test_manual_assistant_call_path(self) -> None:
        result = self.engine.process(
            {
                "speech_text": "I don't understand how to graph sin",
                "current_task": "building RoboPhone Blockly graph",
                "emotion": "confused",
                "emotion_confidence": 0.82,
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["action_type"], "manual_guidance")
        self.assertEqual(len(self.manual.calls), 1)
        self.assertEqual(self.manual.calls[0]["detail_level"], "step_by_step")

    def test_cooldown_suppresses_repeated_nonverbal_response(self) -> None:
        first = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "confused",
                    "confidence": 0.9,
                    "source": "test",
                    "is_stable": True,
                },
                "current_task": "task",
            }
        )
        second = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "confused",
                    "confidence": 0.9,
                    "source": "test",
                    "is_stable": True,
                },
                "current_task": "task",
            }
        )
        self.assertTrue(first["should_speak"])
        self.assertFalse(second["should_speak"])
        self.assertEqual(second["reason"], "Cooldown active")

    def test_unstable_emotion_stays_quiet(self) -> None:
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "confused",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": False,
                }
            }
        )
        self.assertFalse(result["should_speak"])
        self.assertEqual(result["reason"], "Emotion not stable enough for a proactive response")

    def test_angry_gets_teacher_response(self) -> None:
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "angry",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertIn("frustrating", result["response_text"].lower())

    def test_neutral_gets_teacher_response(self) -> None:
        self.clock.advance(30)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "neutral",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertIn("next robophone step", result["response_text"].lower())

    def test_silent_mode_blocks_non_resume_help_response(self) -> None:
        first = self.engine.process({"speech_text": "stop responding"})
        self.assertTrue(first["should_speak"])
        result = self.engine.process(
            {
                "speech_text": "how do I display text on the LCD?",
                "current_task": "LCD task",
            }
        )
        self.assertFalse(result["should_speak"])
        self.assertEqual(result["reason"], "Silent mode is active")

    def test_resume_command_works_during_silent_mode(self) -> None:
        self.engine.process({"speech_text": "be quiet"})
        result = self.engine.process({"speech_text": "respond normally"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["updated_state"]["responsiveness_mode"], "normal")

    def test_low_mode_shortens_manual_response(self) -> None:
        self.engine.process({"speech_text": "talk less"})
        result = self.engine.process(
            {"speech_text": "How do I graph sin and cos?", "current_task": "graphing"}
        )
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["updated_state"]["responsiveness_mode"], "low")
        self.assertEqual(self.manual.calls[-1]["detail_level"], "brief")
        self.assertLessEqual(len(result["response_text"]), 140)


if __name__ == "__main__":
    unittest.main()
