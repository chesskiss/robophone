from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from robophone.avatar_er.models import ConversationMessage, EmotionSignal
from robophone.avatar_er.state import JsonAvatarSessionStore


class JsonSessionStoreTests(unittest.TestCase):
    def test_round_trip_persists_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "session.json"
            store = JsonAvatarSessionStore(session_path)
            store.record_emotion("sad")
            store.record_answered_topic("sin function")

            reloaded = JsonAvatarSessionStore(session_path)
            state = reloaded.get_state()
            self.assertEqual(state.recent_emotions[-1], "sad")
            self.assertEqual(state.recent_answered_topics[-1], "sin function")

    def test_two_instances_share_updates(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "session.json"
            writer = JsonAvatarSessionStore(session_path)
            reader = JsonAvatarSessionStore(session_path)

            writer.record_emotion_signal(EmotionSignal(emotion="happy", confidence=0.9, is_stable=True))
            state = reader.get_state()
            self.assertEqual(state.recent_emotion_events[-1]["emotion"], "happy")

    def test_missing_file_initializes_cleanly(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "missing.json"
            store = JsonAvatarSessionStore(session_path)
            state = store.get_state()
            self.assertEqual(state.recent_emotions, [])
            self.assertTrue(session_path.exists())

    def test_corrupted_file_raises_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "corrupted.json"
            session_path.write_text("{not valid json", encoding="utf-8")
            with self.assertRaises(RuntimeError) as ctx:
                JsonAvatarSessionStore(session_path)
            self.assertIn("Corrupted ER session file", str(ctx.exception))

    def test_conversation_history_persists_across_instances(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "session.json"
            first = JsonAvatarSessionStore(session_path)
            first.add_conversation_message(
                ConversationMessage(role="teacher", text="How are you feeling?", source="emotion_prompt")
            )

            second = JsonAvatarSessionStore(session_path)
            state = second.get_state()
            self.assertEqual(state.conversation_history[-1]["text"], "How are you feeling?")


if __name__ == "__main__":
    unittest.main()
