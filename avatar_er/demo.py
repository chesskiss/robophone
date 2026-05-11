from __future__ import annotations

import json

from .decision import AvatarDecisionEngine
from .models import ManualQaRequest, ManualQaResponse
from .state import AvatarSessionStore


class DemoManualQaProvider:
    def answer(self, request: ManualQaRequest) -> ManualQaResponse:
        return ManualQaResponse(
            answer_text=(
                "Start with Flow Control -> Start Program, then add the graphing blocks step by step."
            ),
            backend="demo",
        )


def main() -> int:
    engine = AvatarDecisionEngine(
        store=AvatarSessionStore(),
        manual_qa_provider=DemoManualQaProvider(),
    )
    samples = [
        {
            "emotion_signal": {
                "emotion": "confused",
                "confidence": 0.91,
                "source": "demo",
                "source_face_id": "student_1",
                "is_stable": True,
            },
            "current_task": "building RoboPhone Blockly graph",
        },
        {"speech_signal": {"text": "stop responding", "source": "demo"}, "face_id": "student_1"},
        {"speech_signal": {"text": "talk less", "source": "demo"}, "face_id": "student_1"},
        {
            "speech_signal": {"text": "I don't understand how to graph sin", "source": "demo"},
            "emotion_signal": {
                "emotion": "confused",
                "confidence": 0.82,
                "source": "demo",
                "is_stable": True,
            },
            "current_task": "building RoboPhone Blockly graph",
        },
        {
            "speech_signal": {"text": "how do I display text on the LCD?", "source": "demo"},
            "current_task": "testing RoboPhone LCD output",
            "objects": ["phone", "notebook"],
        },
        {
            "emotion_signal": {
                "emotion": "neutral",
                "confidence": 0.88,
                "source": "demo",
                "source_face_id": "student_1",
                "is_stable": True,
            }
        },
    ]

    for index, sample in enumerate(samples, start=1):
        result = engine.process(sample)
        print(f"\nScenario {index}")
        print(json.dumps({"input": sample, "result": result}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
