from __future__ import annotations

import re
import time
from dataclasses import replace
from typing import Callable

from .commands import apply_command_result, interpret_command
from .intent import classify_intent
from .models import (
    AvatarState,
    ConversationMessage,
    ConversationResponseRequest,
    ConversationRouteRequest,
    DecisionResult,
    EmotionResponseRequest,
    ManualQaRequest,
    PerceptionInput,
)
from .providers import (
    ConversationResponseProvider,
    ConversationRouteProvider,
    EmotionResponseProvider,
    ManualQaProvider,
)
from .response import format_spoken_response
from .state import AvatarSessionStore


class AvatarDecisionEngine:
    USER_TURN_COOLDOWN_MULTIPLIER = 2.0
    EMOTION_SHIFT_DWELL_SECONDS = 8.0
    MIN_SHORTENED_COOLDOWN_SECONDS = 8.0

    def __init__(
        self,
        store: AvatarSessionStore | None = None,
        manual_qa_provider: ManualQaProvider | None = None,
        emotion_response_provider: EmotionResponseProvider | None = None,
        conversation_route_provider: ConversationRouteProvider | None = None,
        conversation_response_provider: ConversationResponseProvider | None = None,
        clock: Callable[[], float] | None = None,
    ):
        self.store = store or AvatarSessionStore()
        self.manual_qa_provider = manual_qa_provider
        self.emotion_response_provider = emotion_response_provider
        self.conversation_route_provider = conversation_route_provider
        self.conversation_response_provider = conversation_response_provider
        self.clock = clock or time.time

    def process(self, perception_payload: dict) -> dict:
        perception = PerceptionInput.from_dict(perception_payload)
        decision = self.evaluate(perception)
        return decision.to_public_dict()

    def evaluate(self, perception: PerceptionInput) -> DecisionResult:
        state = self.store.get_state()
        self.store.update_task(perception.current_task)
        if perception.current_task:
            state.current_task = perception.current_task
        if perception.emotion_signal and perception.emotion_signal.emotion:
            self._record_stable_emotion_change(perception.emotion_signal)
            self.store.record_emotion(perception.emotion_signal.emotion)
            self.store.record_emotion_signal(perception.emotion_signal)
        elif perception.emotion:
            self.store.record_emotion(perception.emotion)
        if perception.speech_signal and perception.speech_signal.text:
            self.store.record_speech(perception.speech_signal.text)
        state = self.store.get_state()

        speech_text = (perception.speech_signal.text if perception.speech_signal else perception.speech_text or "").strip()
        intent = classify_intent(speech_text, state)
        command_result = interpret_command(speech_text, state)

        if command_result.handled:
            state = apply_command_result(state, command_result)
            self.store.record_command(command_result.command_name or speech_text)
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="settings_update",
                reason=f"Handled settings command: {command_result.command_name}",
                response_text=command_result.response_text,
                mark_response=True,
                payload={"intent": intent.intent, "updated_settings": command_result.updated_settings},
                allow_silent_mode_speech=True,
                turn_type="settings_update",
            )

        if state.responsiveness_mode == "silent":
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Silent mode is active",
                response_text=None,
                mark_response=False,
                payload={"intent": intent.intent},
                allow_silent_mode_speech=False,
            )

        if speech_text:
            return self._handle_conversation_turn(perception, state, speech_text)

        if intent.intent in {"help_request", "explanation_request", "manual_block_guidance_request"}:
            detail_level = "brief" if state.responsiveness_mode == "low" else "step_by_step"
            try:
                answer = self._generate_manual_guidance(
                    user_request=speech_text,
                    current_task=state.current_task,
                    perception_context=perception.to_dict(),
                    tone=state.tone,
                    detail_level=detail_level,
                )
            except Exception as exc:
                answer = (
                    "I couldn't reach the RoboPhone manual guidance backend right now. "
                    "Please verify the ground_eval runtime wiring."
                )
                reason = f"Manual assistant call failed: {exc}"
            else:
                reason = f"User asked for {intent.intent.replace('_', ' ')}"
                state.last_answered_question = speech_text

            return self._finalize(
                state=state,
                should_respond=True,
                action_type="manual_guidance",
                reason=reason,
                response_text=answer,
                mark_response=True,
                payload={"intent": intent.intent, "detail_level": detail_level},
                allow_silent_mode_speech=False,
            )

        if intent.intent == "encouragement_request":
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="encouragement",
                reason="User asked for encouragement",
                response_text="Yes. You're on the right track. Keep building one block at a time.",
                mark_response=True,
                payload={"intent": intent.intent},
                allow_silent_mode_speech=False,
                turn_type="user_driven_chat",
            )

        if intent.intent == "unknown" and speech_text:
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Speech did not match a handled intent",
                response_text=None,
                mark_response=False,
                payload={"intent": intent.intent},
                allow_silent_mode_speech=False,
            )

        return self._handle_nonverbal(perception, state, intent.intent)

    def _handle_conversation_turn(
        self,
        perception: PerceptionInput,
        state: AvatarState,
        speech_text: str,
    ) -> DecisionResult:
        child_message = ConversationMessage(
            role="child",
            text=speech_text,
            timestamp=self.clock(),
            source=perception.input_source,
        )
        self.store.add_conversation_message(child_message)
        self.store.set_conversation_active(True)
        state = self.store.get_state()

        recent_topic_response = self._maybe_answer_recent_topic(state, speech_text, perception)
        if recent_topic_response is not None:
            return recent_topic_response

        route_result = self._classify_conversation_route(state, speech_text, perception)
        route = route_result.route
        if route == "manual_help":
            detail_level = "brief" if state.responsiveness_mode == "low" else "step_by_step"
            manual_error = None
            try:
                answer = self._generate_manual_guidance(
                    user_request=speech_text,
                    current_task=state.current_task,
                    perception_context=perception.to_dict(),
                    tone=state.tone,
                    detail_level=detail_level,
                )
            except Exception as exc:
                answer = (
                    "I couldn't reach the RoboPhone manual guidance backend right now. "
                    "Please verify the ground_eval runtime wiring."
                )
                reason = f"Manual assistant call failed: {exc}"
                backend = "fallback"
                manual_error = str(exc)
            else:
                reason = "Conversation turn routed to RoboPhone manual help"
                backend = "robophone.ground_eval"
                state.last_answered_question = speech_text
                self.store.record_answered_topic(self._extract_topic_key(speech_text))
                state = self.store.get_state()

            return self._finalize(
                state=state,
                should_respond=True,
                action_type="manual_guidance",
                reason=reason,
                response_text=answer,
                mark_response=True,
                payload={
                    "conversation_active": True,
                    "route": route,
                    "used_backend": backend,
                    "detail_level": detail_level,
                    "backend_error": manual_error or route_result.metadata.get("error"),
                },
                allow_silent_mode_speech=False,
                teacher_source=perception.input_source,
                teacher_route=route,
                turn_type="manual_help",
            )

        answer, backend, response_error = self._generate_conversation_response(state, speech_text, perception)
        return self._finalize(
            state=state,
            should_respond=True,
            action_type="conversation_response",
            reason="Conversation turn routed to general teacher conversation",
            response_text=answer,
            mark_response=True,
            payload={
                "conversation_active": True,
                "route": route,
                "used_backend": backend,
                "backend_error": response_error or route_result.metadata.get("error"),
            },
            allow_silent_mode_speech=False,
            teacher_source=perception.input_source,
            teacher_route=route,
            turn_type="user_driven_chat",
        )

    def _generate_manual_guidance(
        self,
        user_request: str,
        current_task: str | None,
        perception_context: dict,
        tone: str,
        detail_level: str,
    ) -> str:
        if self.manual_qa_provider is None:
            raise RuntimeError("No ManualQaProvider configured.")
        response = self.manual_qa_provider.answer(
            ManualQaRequest(
                question=user_request,
                current_task=current_task,
                tone=tone,
                detail_level=detail_level,
                context=perception_context,
            )
        )
        return response.answer_text

    def _handle_nonverbal(
        self,
        perception: PerceptionInput,
        state: AvatarState,
        intent_name: str,
    ) -> DecisionResult:
        emotion_signal = perception.emotion_signal
        emotion = ((emotion_signal.emotion if emotion_signal else perception.emotion) or "").lower()
        confidence = (
            emotion_signal.confidence
            if emotion_signal and emotion_signal.confidence is not None
            else perception.emotion_confidence or 0.0
        )
        is_stable = emotion_signal.is_stable if emotion_signal is not None else True
        if confidence < 0.45:
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Emotion confidence too low for a proactive response",
                response_text=None,
                mark_response=False,
                payload={"intent": intent_name, "emotion": emotion},
                allow_silent_mode_speech=False,
            )

        if not is_stable:
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="emotion_observation",
                reason="Emotion not stable enough for a proactive response",
                response_text=None,
                mark_response=False,
                payload={"intent": intent_name, "emotion": emotion},
                allow_silent_mode_speech=False,
            )

        cooldown_ready, cooldown_reason, cooldown_shortened = self._cooldown_status(state, emotion)
        if not cooldown_ready:
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Cooldown active",
                response_text=None,
                mark_response=False,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
            )

        if self._should_suppress_repeated_emotion_checkin(state, emotion):
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Repeated emotion recently acknowledged",
                response_text=None,
                mark_response=False,
                payload={"intent": intent_name, "emotion": emotion},
                allow_silent_mode_speech=False,
            )

        if emotion == "confused":
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence confused expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion in {"frustrated", "sad"}:
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence frustrated or sad expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion in {"engaged", "happy"}:
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="encouragement",
                reason="High-confidence positive expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion in {"fear", "surprise"}:
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence startled expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion == "angry":
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence angry expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion == "disgust":
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence discomfort expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        if emotion == "neutral":
            fallback = self._build_local_emotion_response(state, emotion)
            response_text = self._generate_emotion_response(state, emotion, perception, fallback)
            self.store.record_proactive_emotion(emotion, self.clock())
            state = self.store.get_state()
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence neutral expression",
                response_text=response_text,
                mark_response=True,
                payload={
                    "intent": intent_name,
                    "emotion": emotion,
                    "cooldown_reason": cooldown_reason,
                    "cooldown_shortened_by_emotion": cooldown_shortened,
                },
                allow_silent_mode_speech=False,
                turn_type="proactive_emotion",
            )

        return self._finalize(
            state=state,
            should_respond=False,
            action_type="none",
            reason="Emotion did not warrant a proactive response",
            response_text=None,
            mark_response=False,
            payload={"intent": intent_name, "emotion": emotion},
            allow_silent_mode_speech=False,
        )

    def _finalize(
        self,
        state: AvatarState,
        should_respond: bool,
        action_type: str,
        reason: str,
        response_text: str | None,
        mark_response: bool,
        payload: dict,
        allow_silent_mode_speech: bool,
        teacher_source: str | None = None,
        teacher_route: str | None = None,
        turn_type: str | None = None,
    ) -> DecisionResult:
        final_state = replace(state)
        if mark_response and should_respond:
            now = self.clock()
            final_state.last_response_timestamp = now
            final_state = self._apply_turn_timing(final_state, turn_type, now)

        spoken_text = format_spoken_response(
            text=response_text,
            mode=final_state.responsiveness_mode,
            tone=final_state.tone,
            should_speak=should_respond,
            allow_silent_mode_speech=allow_silent_mode_speech,
        )
        self.store.set_state(final_state)
        if spoken_text is not None and mark_response:
            self.store.add_conversation_message(
                ConversationMessage(
                    role="teacher",
                    text=spoken_text,
                    timestamp=self.clock(),
                    source=teacher_source or "emotion_prompt",
                    route=teacher_route,
                )
            )
            self.store.set_conversation_active(True)
            final_state = self.store.get_state()
        return DecisionResult(
            should_respond=spoken_text is not None,
            action_type=action_type,
            reason=reason,
            response_text=spoken_text,
            updated_state=final_state.to_dict(),
            payload={
                **payload,
                "conversation_active": final_state.conversation_active,
                "route": payload.get("route"),
                "used_backend": payload.get("used_backend"),
                "last_turn_type": turn_type,
            },
        )

    def _cooldown_status(self, state: AvatarState, emotion: str) -> tuple[bool, str, bool]:
        now = self.clock()
        base = float(state.cooldown_seconds)
        effective = base
        reason = "base"
        shortened = False

        if state.last_user_turn_timestamp is not None:
            effective = max(effective, base * self.USER_TURN_COOLDOWN_MULTIPLIER)
            reason = "recent_user_turn"
            if (
                state.last_stable_emotion_value
                and state.last_stable_emotion_value == emotion
                and state.last_stable_emotion_timestamp is not None
                and state.last_stable_emotion_timestamp > state.last_user_turn_timestamp
                and (now - state.last_stable_emotion_timestamp) >= self.EMOTION_SHIFT_DWELL_SECONDS
            ):
                effective = self.MIN_SHORTENED_COOLDOWN_SECONDS
                reason = "stable_emotion_change_after_user_turn"
                shortened = True

        reference = state.last_proactive_turn_timestamp or state.last_response_timestamp
        if reference is None:
            return True, reason, shortened
        return (now - reference) >= effective, reason, shortened

    def _generate_emotion_response(
        self,
        state: AvatarState,
        emotion: str,
        perception: PerceptionInput,
        fallback: str,
    ) -> str:
        if self.emotion_response_provider is None:
            return fallback
        try:
            response = self.emotion_response_provider.answer(
                EmotionResponseRequest(
                    emotion=emotion,
                    current_task=state.current_task,
                    tone=state.tone,
                    context=perception.to_dict(),
                    recent_emotions=list(state.recent_emotion_events),
                    recent_speech_texts=list(state.recent_speech_texts),
                    last_teacher_prompt=state.last_teacher_prompt,
                    follow_up_style=state.next_emotion_follow_up_style,
                )
            )
        except Exception:
            return fallback
        return response.response_text or fallback

    def _classify_conversation_route(
        self,
        state: AvatarState,
        speech_text: str,
        perception: PerceptionInput,
    ):
        heuristic_route = self._heuristic_conversation_route(speech_text)
        if heuristic_route is not None:
            from .models import ConversationRouteResult

            return ConversationRouteResult(route=heuristic_route, backend="local_heuristic")
        if self.conversation_route_provider is None:
            from .models import ConversationRouteResult

            return ConversationRouteResult(
                route="general_conversation",
                backend="fallback",
                metadata={"error": "No ConversationRouteProvider configured."},
            )
        try:
            return self.conversation_route_provider.classify(
                ConversationRouteRequest(
                    user_text=speech_text,
                    current_task=state.current_task,
                    tone=state.tone,
                    context=perception.to_dict(),
                    conversation_history=list(state.conversation_history),
                    recent_emotions=list(state.recent_emotion_events),
                )
            )
        except Exception as exc:
            from .models import ConversationRouteResult

            return ConversationRouteResult(
                route="general_conversation",
                backend="fallback",
                metadata={"error": str(exc)},
            )

    def _generate_conversation_response(
        self,
        state: AvatarState,
        speech_text: str,
        perception: PerceptionInput,
    ) -> tuple[str, str, str | None]:
        fallback = "I hear you. Tell me what part you want to work through next, and we'll take it one step at a time."
        if self.conversation_response_provider is None:
            local_response = self._local_conversation_response(state, speech_text)
            return local_response or fallback, "fallback", "No ConversationResponseProvider configured."
        latest_emotion = None
        if state.recent_emotion_events:
            latest_emotion = state.recent_emotion_events[-1].get("emotion")
        try:
            response = self.conversation_response_provider.answer(
                ConversationResponseRequest(
                    user_text=speech_text,
                    current_task=state.current_task,
                    tone=state.tone,
                    context=perception.to_dict(),
                    conversation_history=list(state.conversation_history),
                    recent_emotions=list(state.recent_emotion_events),
                    latest_emotion=latest_emotion,
                )
            )
        except Exception as exc:
            local_response = self._local_conversation_response(state, speech_text)
            return local_response or fallback, "fallback", str(exc)
        return response.response_text or fallback, response.backend, None

    def _heuristic_conversation_route(self, speech_text: str) -> str | None:
        text = speech_text.lower()
        manual_keywords = (
            "graph",
            "sin",
            "cos",
            "lcd",
            "block",
            "program",
            "display text",
            "function",
            "robot",
            "code",
            "wire",
            "start program",
        )
        if "how am i feeling" in text or "what emotion" in text or "how do i look" in text:
            return "general_conversation"
        if any(keyword in text for keyword in manual_keywords):
            return "manual_help"
        if any(keyword in text for keyword in ("sad", "upset", "frustrated", "angry", "worried", "feeling")):
            return "general_conversation"
        return None

    def _local_conversation_response(self, state: AvatarState, speech_text: str) -> str | None:
        text = speech_text.strip().lower()
        latest_emotion = self._latest_emotion(state)
        if any(phrase in text for phrase in ("how am i feeling", "what emotion", "how do i look", "how am i doing")):
            return self._build_feelings_answer(state, latest_emotion)

        topic = self._extract_topic_key(speech_text)
        if topic and topic in state.recent_answered_topics:
            return f"We already went over {topic}. Do you want a quick recap or the next step?"

        if "sad" in text or "upset" in text or "i feel bad" in text:
            return "You seem a bit down. If you want, tell me what happened, and we can slow things down together."
        if "frustrated" in text or "angry" in text:
            return "That sounds frustrating. Tell me which part went wrong, and we'll fix one piece at a time."
        if any(phrase in text for phrase in ("thank you", "thanks")):
            return "You're welcome. If you want, we can keep going with the next step."
        return None

    def _maybe_answer_recent_topic(
        self,
        state: AvatarState,
        speech_text: str,
        perception: PerceptionInput,
    ) -> DecisionResult | None:
        topic = self._extract_topic_key(speech_text)
        if not topic or topic not in state.recent_answered_topics:
            return None
        if not any(token in speech_text.lower() for token in ("again", "recap", "repeat", "still", "remember")):
            return None
        return self._finalize(
            state=state,
            should_respond=True,
            action_type="conversation_response",
            reason="Recently answered topic recalled from session memory",
            response_text=f"We already went over {topic}. Do you want a quick recap or the next step?",
            mark_response=True,
            payload={
                "conversation_active": True,
                "route": "general_conversation",
                "used_backend": "local_memory",
                "backend_error": None,
            },
            allow_silent_mode_speech=False,
            teacher_source=perception.input_source,
            teacher_route="general_conversation",
        )

    def _build_feelings_answer(self, state: AvatarState, latest_emotion: str | None) -> str:
        streak = self._emotion_streak(state, latest_emotion or "")
        if latest_emotion in {"sad", "frustrated", "angry"}:
            if streak >= 2:
                return f"You still seem {latest_emotion}. We do not have to force the pace. We can pause or focus on one small step."
            return f"You seem a bit {latest_emotion}. Is everything all right, or is a specific part bothering you?"
        if latest_emotion in {"happy", "engaged"}:
            return "You seem more comfortable right now. If you're ready, we can keep going."
        if latest_emotion in {"confused", "surprise", "fear"}:
            return "You look a little unsure right now. Tell me what feels unclear, and we will work through it."
        return "You seem fairly neutral right now. If something feels off, tell me and I can help."

    def _build_local_emotion_response(self, state: AvatarState, emotion: str) -> str:
        streak = self._emotion_streak(state, emotion)
        last_topic = state.recent_answered_topics[-1] if state.recent_answered_topics else None
        if emotion == "confused":
            if last_topic:
                return f"You look a bit stuck. We already talked about {last_topic}; do you want a quick recap or the next step?"
            return "You look a bit stuck. Tell me which step is unclear, and we will work through it together."
        if emotion in {"sad", "frustrated"}:
            if streak >= 2:
                if last_topic:
                    return f"You still seem a bit down. We already covered {last_topic}; want a quick recap or the next step?"
                return "You still seem a bit down. I won't keep pushing; if you want, tell me what feels off and we'll slow it down."
            return "You seem a bit down. Is everything all right, or is a specific part of the task bothering you?"
        if emotion == "angry":
            if streak >= 2:
                return "This still seems frustrating. Let's stop changing things for a second and isolate just one problem."
            return "This seems frustrating. Tell me what part went wrong, and we'll fix one piece at a time."
        if emotion in {"happy", "engaged"}:
            return "You seem more comfortable now. Keep going, and tell me if you want help with the next step."
        if emotion in {"fear", "surprise"}:
            return "Something seems unexpected. Let's check the last thing that changed and make sense of it."
        if emotion == "disgust":
            if streak >= 2:
                return "You still seem uncomfortable. I won't keep pushing, but if something feels off, tell me."
            return "You seem a bit uncomfortable. Is everything okay?"
        if emotion == "neutral":
            if state.last_teacher_prompt:
                return "You seem fairly steady right now. I'm here if you want help."
            return "You seem fairly steady right now."
        return "Tell me what part you want to work through next, and we'll take it one step at a time."

    def _should_suppress_repeated_emotion_checkin(self, state: AvatarState, emotion: str) -> bool:
        if emotion not in {"sad", "frustrated", "angry"}:
            return False
        if state.last_proactive_emotion != emotion:
            return False
        if state.last_proactive_emotion_timestamp is None:
            return False
        if self._emotion_streak(state, emotion) < 2:
            return False
        return (self.clock() - state.last_proactive_emotion_timestamp) < max(state.cooldown_seconds * 2, 45)

    def _emotion_streak(self, state: AvatarState, emotion: str) -> int:
        if not emotion:
            return 0
        streak = 0
        for entry in reversed(state.recent_emotion_events):
            if entry.get("emotion") != emotion:
                break
            streak += 1
        return streak

    def _latest_emotion(self, state: AvatarState) -> str | None:
        if not state.recent_emotion_events:
            return None
        return state.recent_emotion_events[-1].get("emotion")

    def _extract_topic_key(self, text: str) -> str | None:
        normalized = text.lower()
        topic_patterns = {
            "cos function": r"\bcos\b",
            "sin function": r"\bsin\b",
            "graphing": r"\bgraph\b",
            "lcd display": r"\blcd\b|\bdisplay text\b",
            "program blocks": r"\bblock\b|\bprogram\b",
        }
        for topic, pattern in topic_patterns.items():
            if re.search(pattern, normalized):
                return topic
        return None

    def _record_stable_emotion_change(self, signal: object) -> None:
        emotion = getattr(signal, "emotion", None)
        is_stable = getattr(signal, "is_stable", False)
        if not emotion or not is_stable:
            return
        state = self.store.get_state()
        if state.last_stable_emotion_value == emotion:
            return
        self.store.record_turn_timing(
            stable_emotion_timestamp=self.clock(),
            stable_emotion_value=emotion,
        )

    def _apply_turn_timing(self, state: AvatarState, turn_type: str | None, now: float) -> AvatarState:
        updated = replace(state)
        if turn_type in {"user_driven_chat", "manual_help"}:
            updated.last_user_turn_timestamp = now
            updated.effective_cooldown_until = now + max(
                float(updated.cooldown_seconds),
                float(updated.cooldown_seconds) * self.USER_TURN_COOLDOWN_MULTIPLIER,
            )
        elif turn_type == "proactive_emotion":
            updated.last_proactive_turn_timestamp = now
            updated.last_stable_emotion_acknowledged = updated.last_stable_emotion_value
            updated.effective_cooldown_until = now + float(updated.cooldown_seconds)
            updated.next_emotion_follow_up_style = (
                "statement" if updated.next_emotion_follow_up_style == "question" else "question"
            )
        return updated
