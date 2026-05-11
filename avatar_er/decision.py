from __future__ import annotations

import time
from dataclasses import replace
from typing import Callable

from .commands import apply_command_result, interpret_command
from .intent import classify_intent
from .models import AvatarState, DecisionResult, ManualQaRequest, PerceptionInput
from .providers import ManualQaProvider
from .response import format_spoken_response
from .state import AvatarSessionStore


class AvatarDecisionEngine:
    def __init__(
        self,
        store: AvatarSessionStore | None = None,
        manual_qa_provider: ManualQaProvider | None = None,
        clock: Callable[[], float] | None = None,
    ):
        self.store = store or AvatarSessionStore()
        self.manual_qa_provider = manual_qa_provider
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
            self.store.record_emotion(perception.emotion_signal.emotion)
        elif perception.emotion:
            self.store.record_emotion(perception.emotion)
        if perception.speech_signal and perception.speech_signal.text:
            self.store.record_speech(perception.speech_signal.text)

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
        if confidence < 0.75:
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Emotion confidence too low for a proactive response",
                response_text=None,
                mark_response=False,
                payload={"intent": intent_name},
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

        if not self._cooldown_passed(state):
            return self._finalize(
                state=state,
                should_respond=False,
                action_type="none",
                reason="Cooldown active",
                response_text=None,
                mark_response=False,
                payload={"intent": intent_name},
                allow_silent_mode_speech=False,
            )

        if emotion in {"confused", "frustrated"}:
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="emotion_check_in",
                reason="High-confidence confused or frustrated expression",
                response_text="You look stuck. Do you want help with the next RoboPhone step?",
                mark_response=True,
                payload={"intent": intent_name, "emotion": emotion},
                allow_silent_mode_speech=False,
            )

        if emotion in {"engaged", "happy"}:
            return self._finalize(
                state=state,
                should_respond=True,
                action_type="encouragement",
                reason="High-confidence positive expression",
                response_text="Nice progress. Keep going.",
                mark_response=True,
                payload={"intent": intent_name, "emotion": emotion},
                allow_silent_mode_speech=False,
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
    ) -> DecisionResult:
        final_state = replace(state)
        if mark_response and should_respond:
            final_state.last_response_timestamp = self.clock()
        self.store.set_state(final_state)

        spoken_text = format_spoken_response(
            text=response_text,
            mode=final_state.responsiveness_mode,
            tone=final_state.tone,
            should_speak=should_respond,
            allow_silent_mode_speech=allow_silent_mode_speech,
        )
        return DecisionResult(
            should_respond=spoken_text is not None,
            action_type=action_type,
            reason=reason,
            response_text=spoken_text,
            updated_state=final_state.to_dict(),
            payload=payload,
        )

    def _cooldown_passed(self, state: AvatarState) -> bool:
        if state.last_response_timestamp is None:
            return True
        return (self.clock() - state.last_response_timestamp) >= state.cooldown_seconds
