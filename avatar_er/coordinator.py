from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable

from .decision import AvatarDecisionEngine
from .models import EmotionSignal, PerceptionInput
from .providers import EmotionProvider, SpeechProvider


@dataclass(slots=True)
class AvatarLiveCoordinator:
    engine: AvatarDecisionEngine
    emotion_provider: EmotionProvider | None = None
    speech_provider: SpeechProvider | None = None
    current_task: str | None = None

    def process_emotion_signal(self, emotion_signal: EmotionSignal) -> dict:
        perception = PerceptionInput(
            emotion_signal=emotion_signal,
            emotion=emotion_signal.emotion,
            emotion_confidence=emotion_signal.confidence,
            face_id=emotion_signal.source_face_id,
            current_task=self.current_task,
        )
        return self.engine.evaluate(perception).to_public_dict()

    def process_next_events(self) -> list[dict]:
        results: list[dict] = []
        latest_emotion = self.emotion_provider.get_latest() if self.emotion_provider else None
        if latest_emotion is not None:
            results.append(self.process_emotion_signal(latest_emotion))

        latest_speech = self.speech_provider.get_latest() if self.speech_provider else None
        if latest_speech is not None:
            perception = PerceptionInput(
                emotion_signal=latest_emotion,
                speech_signal=latest_speech,
                emotion=latest_emotion.emotion if latest_emotion else None,
                emotion_confidence=latest_emotion.confidence if latest_emotion else None,
                speech_text=latest_speech.text,
                face_id=latest_emotion.source_face_id if latest_emotion else None,
                current_task=self.current_task,
            )
            results.append(self.engine.evaluate(perception).to_public_dict())
        return results

    def run_debug_loop(
        self,
        poll_interval_seconds: float = 0.2,
        on_result: Callable[[dict], None] | None = None,
    ) -> None:
        if self.speech_provider is not None:
            self.speech_provider.start()

        try:
            while True:
                for result in self.process_next_events():
                    if on_result is not None:
                        on_result(result)
                    else:
                        print(result)
                time.sleep(poll_interval_seconds)
        finally:
            if self.speech_provider is not None:
                self.speech_provider.stop()
            if self.emotion_provider is not None:
                self.emotion_provider.close()
