from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from robophone.avatar_er.decision import AvatarDecisionEngine
from robophone.avatar_er.models import (
    ConversationResponse,
    ConversationResponseRequest,
    ConversationRouteRequest,
    ConversationRouteResult,
    EmotionResponse,
    EmotionResponseRequest,
    EmotionSignal,
    ManualQaRequest,
    ManualQaResponse,
)
from robophone.avatar_er.state import AvatarSessionStore, JsonAvatarSessionStore


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


class MockEmotionResponseProvider:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def answer(self, request: EmotionResponseRequest) -> EmotionResponse:
        self.calls.append(
            {
                "emotion": request.emotion,
                "recent_emotions": request.recent_emotions,
                "recent_speech_texts": request.recent_speech_texts,
                "current_task": request.current_task,
            }
        )
        return EmotionResponse(response_text=f"LLM teacher response for {request.emotion}.", backend="gemini")


class MockConversationRouteProvider:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.default_route = "general_conversation"
        self.fail = False

    def classify(self, request: ConversationRouteRequest) -> ConversationRouteResult:
        self.calls.append(
            {
                "user_text": request.user_text,
                "current_task": request.current_task,
                "conversation_history": request.conversation_history,
                "recent_emotions": request.recent_emotions,
            }
        )
        if self.fail:
            raise RuntimeError("route failure")
        return ConversationRouteResult(route=self.default_route, backend="gemini")


class MockConversationResponseProvider:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.fail = False

    def answer(self, request: ConversationResponseRequest) -> ConversationResponse:
        self.calls.append(
            {
                "user_text": request.user_text,
                "current_task": request.current_task,
                "conversation_history": request.conversation_history,
                "recent_emotions": request.recent_emotions,
                "latest_emotion": request.latest_emotion,
            }
        )
        if self.fail:
            raise RuntimeError("response failure")
        return ConversationResponse(response_text=f"Teacher reply to: {request.user_text}", backend="gemini")


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
        self.emotion_responder = MockEmotionResponseProvider()
        self.route_provider = MockConversationRouteProvider()
        self.conversation_provider = MockConversationResponseProvider()
        self.engine = AvatarDecisionEngine(
            store=AvatarSessionStore(),
            manual_qa_provider=self.manual,
            emotion_response_provider=self.emotion_responder,
            conversation_route_provider=self.route_provider,
            conversation_response_provider=self.conversation_provider,
            clock=self.clock,
        )

    def test_proactive_emotion_starts_conversation_and_records_teacher_message(self) -> None:
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertTrue(result["updated_state"]["conversation_active"])
        history = result["updated_state"]["conversation_history"]
        self.assertEqual(history[-1]["role"], "teacher")
        self.assertEqual(history[-1]["source"], "emotion_prompt")
        self.assertIn("llm teacher response for sad", history[-1]["text"].lower())

    def test_child_typed_reply_is_stored_in_history(self) -> None:
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        result = self.engine.process(
            {
                "speech_text": "I am just upset",
                "input_source": "typed_input",
                "current_task": "graphing",
            }
        )
        history = result["updated_state"]["conversation_history"]
        self.assertEqual(history[-2]["role"], "child")
        self.assertEqual(history[-2]["text"], "I am just upset")
        self.assertEqual(history[-2]["source"], "typed_input")

    def test_active_conversation_reply_bypasses_nonverbal_cooldown(self) -> None:
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        result = self.engine.process({"speech_text": "Can you help me?"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["action_type"], "conversation_response")

    def test_general_conversation_route_calls_gemini_conversation_provider(self) -> None:
        self.route_provider.default_route = "general_conversation"
        result = self.engine.process({"speech_text": "I'm just upset", "current_task": "graphing"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["payload"]["route"], "general_conversation")
        self.assertEqual(result["payload"]["used_backend"], "gemini")
        self.assertEqual(len(self.conversation_provider.calls), 1)
        self.assertEqual(len(self.manual.calls), 0)

    def test_manual_help_route_calls_manual_provider(self) -> None:
        self.route_provider.default_route = "manual_help"
        result = self.engine.process({"speech_text": "I don't get how to graph sin", "current_task": "graphing"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["action_type"], "manual_guidance")
        self.assertEqual(result["payload"]["route"], "manual_help")
        self.assertEqual(result["payload"]["used_backend"], "robophone.ground_eval")
        self.assertEqual(len(self.manual.calls), 1)
        self.assertEqual(len(self.route_provider.calls), 0)

    def test_settings_commands_override_conversation_path(self) -> None:
        result = self.engine.process({"speech_text": "stop responding"})
        self.assertEqual(result["action_type"], "settings_update")
        self.assertEqual(len(self.route_provider.calls), 0)

    def test_bounded_conversation_history_trims_old_messages(self) -> None:
        for index in range(12):
            self.engine.process({"speech_text": f"message {index}"})
        state = self.engine.store.get_state()
        self.assertLessEqual(len(state.conversation_history), 8)
        self.assertEqual(state.conversation_history[0]["text"], "message 8")

    def test_route_failures_fall_back_to_general_conversation(self) -> None:
        self.route_provider.fail = True
        result = self.engine.process({"speech_text": "What should I do next?"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["payload"]["route"], "general_conversation")
        self.assertEqual(result["payload"]["used_backend"], "gemini")

    def test_conversation_response_failures_fall_back_safely(self) -> None:
        self.conversation_provider.fail = True
        result = self.engine.process({"speech_text": "Hello there"})
        self.assertTrue(result["should_speak"])
        self.assertIn("one step at a time", result["response_text"].lower())
        self.assertEqual(result["payload"]["used_backend"], "fallback")

    def test_decision_payload_exposes_conversation_metadata(self) -> None:
        result = self.engine.process({"speech_text": "Hello teacher"})
        self.assertTrue(result["payload"]["conversation_active"])
        self.assertEqual(result["payload"]["route"], "general_conversation")
        self.assertEqual(result["payload"]["used_backend"], "gemini")
        self.assertEqual(result["payload"]["last_turn_type"], "user_driven_chat")

    def test_feelings_question_uses_local_history_based_answer(self) -> None:
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        result = self.engine.process({"speech_text": "how am I feeling now?"})
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["payload"]["used_backend"], "gemini")
        self.assertIn("teacher reply to: how am i feeling now?", result["response_text"].lower())

    def test_chat_process_reads_shared_emotion_state(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            session_path = Path(tmpdir) / "live_session.json"
            emotion_store = JsonAvatarSessionStore(session_path)
            emotion_store.record_emotion("sad")
            emotion_store.record_emotion_signal(
                EmotionSignal(
                    emotion="sad",
                    confidence=0.95,
                    timestamp=1000.0,
                    is_stable=True,
                )
            )
            chat_engine = AvatarDecisionEngine(
                store=JsonAvatarSessionStore(session_path),
                manual_qa_provider=self.manual,
                emotion_response_provider=self.emotion_responder,
                conversation_route_provider=self.route_provider,
                conversation_response_provider=self.conversation_provider,
                clock=self.clock,
            )
            result = chat_engine.process({"speech_text": "how am I feeling now?"})
            self.assertTrue(result["should_speak"])
            self.assertIn("teacher reply to: how am i feeling now?", result["response_text"].lower())
            self.assertEqual(result["payload"]["used_backend"], "gemini")

    def test_repeated_negative_emotion_does_not_nag(self) -> None:
        first = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.clock.advance(30)
        second = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(first["should_speak"])
        self.assertFalse(second["should_speak"])
        self.assertEqual(second["reason"], "Repeated emotion recently acknowledged")

    def test_recently_answered_topic_gets_recap_prompt(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        result = self.engine.process({"speech_text": "Can you explain sin again?", "current_task": "graphing"})
        self.assertTrue(result["should_speak"])
        self.assertIn("quick recap", result["response_text"].lower())
        self.assertEqual(result["payload"]["used_backend"], "local_memory")

    def test_user_turn_increases_proactive_cooldown(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        self.clock.advance(25)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "happy",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertFalse(result["should_speak"])
        self.assertEqual(result["reason"], "Cooldown active")
        self.assertEqual(result["payload"]["cooldown_reason"], "recent_user_turn")

    def test_stable_emotion_change_shortens_cooldown_after_user_turn(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        self.clock.advance(1)
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.clock.advance(8)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertTrue(result["payload"]["cooldown_shortened_by_emotion"])
        self.assertEqual(result["payload"]["cooldown_reason"], "stable_emotion_change_after_user_turn")

    def test_unstable_emotion_change_does_not_shorten_cooldown(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        self.clock.advance(1)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": False,
                }
            }
        )
        self.assertFalse(result["should_speak"])
        self.assertEqual(result["reason"], "Emotion not stable enough for a proactive response")

    def test_proactive_follow_up_allowed_after_extended_cooldown(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        self.clock.advance(41)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "happy",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["payload"]["last_turn_type"], "proactive_emotion")

    def test_proactive_confusion_after_answered_topic_offers_recap(self) -> None:
        self.engine.process({"speech_text": "How do I graph sin?", "current_task": "graphing"})
        self.clock.advance(41)
        result = self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "confused",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                }
            }
        )
        self.assertTrue(result["should_speak"])
        self.assertIn("llm teacher response for confused", result["response_text"].lower())

    def test_emotion_responder_receives_history(self) -> None:
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "happy",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                    "timestamp": 1010.0,
                }
            }
        )
        self.clock.advance(30)
        self.engine.process(
            {
                "emotion_signal": {
                    "emotion": "sad",
                    "confidence": 0.95,
                    "source": "test",
                    "is_stable": True,
                    "timestamp": 1040.0,
                }
            }
        )
        last_call = self.emotion_responder.calls[-1]
        self.assertEqual(last_call["emotion"], "sad")
        self.assertGreaterEqual(len(last_call["recent_emotions"]), 2)

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
        self.route_provider.default_route = "manual_help"
        result = self.engine.process(
            {"speech_text": "How do I graph sin and cos?", "current_task": "graphing"}
        )
        self.assertTrue(result["should_speak"])
        self.assertEqual(result["updated_state"]["responsiveness_mode"], "low")
        self.assertEqual(self.manual.calls[-1]["detail_level"], "brief")
        self.assertLessEqual(len(result["response_text"]), 140)


if __name__ == "__main__":
    unittest.main()
