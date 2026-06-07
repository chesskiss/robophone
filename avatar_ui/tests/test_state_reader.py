from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from robophone.avatar_ui.state_reader import read_avatar_display_state


class AvatarUiStateReaderTests(unittest.TestCase):
    def test_missing_session_returns_waiting_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            state = read_avatar_display_state(Path(tmpdir) / "missing.json")
        self.assertEqual(state["status"], "waiting")
        self.assertIsNone(state["teacher_message"])
        self.assertIsNone(state["emotion"])

    def test_valid_session_extracts_latest_stable_emotion_and_messages(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "session.json"
            session_path.write_text(
                json.dumps(
                    {
                        "conversation_active": True,
                        "last_route": "general_conversation",
                        "recent_emotion_events": [
                            {"emotion": "neutral", "confidence": 0.7, "timestamp": 1, "is_stable": False},
                            {"emotion": "sad", "confidence": 0.91, "timestamp": 2, "is_stable": True},
                        ],
                        "conversation_history": [
                            {"role": "child", "text": "I am stuck", "timestamp": 3, "source": "typed_input"},
                            {
                                "role": "teacher",
                                "text": "Let's slow down and take one step.",
                                "timestamp": 4,
                                "source": "emotion_prompt",
                                "route": "general_conversation",
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )

            state = read_avatar_display_state(session_path)

        self.assertEqual(state["status"], "ready")
        self.assertEqual(state["emotion"], "sad")
        self.assertEqual(state["emotion_confidence"], 0.91)
        self.assertEqual(state["teacher_message"]["text"], "Let's slow down and take one step.")
        self.assertEqual(state["child_message"]["text"], "I am stuck")
        self.assertTrue(state["conversation_active"])

    def test_corrupt_session_returns_error_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "session.json"
            session_path.write_text("{not json", encoding="utf-8")
            state = read_avatar_display_state(session_path)
        self.assertEqual(state["status"], "error")
        self.assertIn("Corrupted ER session JSON", state["error"])


if __name__ == "__main__":
    unittest.main()

