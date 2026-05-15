from __future__ import annotations

import json

from .decision import AvatarDecisionEngine
from .models import (
    ConversationResponse,
    ConversationResponseRequest,
    ConversationRouteRequest,
    ConversationRouteResult,
    ManualQaRequest,
    ManualQaResponse,
)
from .state import AvatarSessionStore


class DemoManualQaProvider:
    def answer(self, request: ManualQaRequest) -> ManualQaResponse:
        return ManualQaResponse(
            answer_text=(
                "Start with Flow Control -> Start Program, then add the graphing blocks step by step."
            ),
            backend="demo",
        )


class DemoConversationRouteProvider:
    def classify(self, request: ConversationRouteRequest) -> ConversationRouteResult:
        text = request.user_text.lower()
        if any(token in text for token in ["graph", "lcd", "block", "program", "sin", "cos"]):
            return ConversationRouteResult(route="manual_help", backend="demo")
        return ConversationRouteResult(route="general_conversation", backend="demo")


class DemoConversationResponseProvider:
    def answer(self, request: ConversationResponseRequest) -> ConversationResponse:
        return ConversationResponse(
            response_text=f"I hear you. Tell me the next part you want to work on: {request.user_text}",
            backend="demo",
        )


def main() -> int:
    engine = AvatarDecisionEngine(
        store=AvatarSessionStore(),
        manual_qa_provider=DemoManualQaProvider(),
        conversation_route_provider=DemoConversationRouteProvider(),
        conversation_response_provider=DemoConversationResponseProvider(),
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
                "emotion": "sad",
                "confidence": 0.88,
                "source": "demo",
                "source_face_id": "student_1",
                "is_stable": True,
            }
        },
        {
            "speech_signal": {"text": "I don't get how to graph sin", "source": "demo"},
            "input_source": "arg_input",
            "current_task": "building RoboPhone Blockly graph",
        },
        {
            "speech_signal": {"text": "I'm just upset", "source": "demo"},
            "input_source": "typed_input",
            "current_task": "building RoboPhone Blockly graph",
        },
    ]

    for index, sample in enumerate(samples, start=1):
        result = engine.process(sample)
        print(f"\nScenario {index}")
        print(json.dumps({"input": sample, "result": result}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
