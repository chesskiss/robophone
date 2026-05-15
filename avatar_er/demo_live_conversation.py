from __future__ import annotations

import argparse
import queue
import threading
import time
from datetime import datetime

try:
    from robophone.emotion_rt import EmotionCameraProvider, EmotionRTConfig
except ImportError:  # pragma: no cover - support running from inside robophone/
    from emotion_rt import EmotionCameraProvider, EmotionRTConfig

from .adapters import (
    GeminiConversationResponseProvider,
    GeminiConversationRouteProvider,
    GeminiEmotionResponseProvider,
    GroundEvalManualQaProvider,
)
from .coordinator import AvatarLiveCoordinator
from .decision import AvatarDecisionEngine
from .state import AvatarSessionStore


class _InputReader:
    def __init__(self) -> None:
        self._queue: queue.SimpleQueue[str | None] = queue.SimpleQueue()
        self._waiting = False

    def ensure_prompt(self) -> None:
        if self._waiting:
            return
        self._waiting = True
        thread = threading.Thread(target=self._read_input, daemon=True)
        thread.start()

    def poll(self) -> str | None:
        try:
            value = self._queue.get_nowait()
        except queue.Empty:
            return None
        self._waiting = False
        return value

    def _read_input(self) -> None:
        try:
            value = input("child> ").strip()
        except EOFError:
            value = "exit"
        self._queue.put(value)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live emotion plus typed conversation debug loop.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument(
        "--backend-type",
        default="hf_vit",
        choices=["hf_vit", "efficientface_pytorch", "efficientface_torchscript"],
    )
    parser.add_argument("--model-id", default="mo-thecreator/vit-Facial-Expression-Recognition")
    parser.add_argument("--model-path", default="emotion_rt/models/Pretrained_EfficientFace.tar")
    parser.add_argument("--current-task", default="live RoboPhone session")
    parser.add_argument("--initial-child-message", default=None)
    parser.add_argument("--interactive-replies", action="store_true")
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    provider = EmotionCameraProvider(
        EmotionRTConfig(
            camera_index=args.camera_index,
            resolution=(args.width, args.height),
            backend_type=args.backend_type,
            model_id=args.model_id,
            model_path=args.model_path,
        )
    )
    engine = AvatarDecisionEngine(
        store=AvatarSessionStore(),
        manual_qa_provider=GroundEvalManualQaProvider(),
        emotion_response_provider=GeminiEmotionResponseProvider(),
        conversation_route_provider=GeminiConversationRouteProvider(),
        conversation_response_provider=GeminiConversationResponseProvider(),
    )
    coordinator = AvatarLiveCoordinator(
        engine=engine,
        emotion_provider=provider,
        current_task=args.current_task,
    )
    initial_message = args.initial_child_message
    input_reader = _InputReader() if args.interactive_replies else None
    if args.interactive_replies:
        print("interactive mode: child input is available immediately while emotion polling continues.")
    try:
        while True:
            for result in coordinator.process_next_events():
                _print_terminal_event(result)

            if initial_message:
                _print_terminal_event(
                    engine.process(
                        {
                            "speech_text": initial_message,
                            "input_source": "arg_input",
                            "current_task": args.current_task,
                        }
                    )
                )
                initial_message = None

            if input_reader is not None:
                input_reader.ensure_prompt()
                reply = input_reader.poll()
                if reply is None:
                    time.sleep(0.2)
                    continue
                if reply.lower() in {"quit", "exit"}:
                    return 0
                if reply:
                    _print_terminal_event(
                        engine.process(
                            {
                                "speech_text": reply,
                                "input_source": "typed_input",
                                "current_task": args.current_task,
                            }
                        )
                    )
            time.sleep(0.2)
    except KeyboardInterrupt:
        return 0
    finally:
        provider.close()


def _print_terminal_event(result: dict) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    payload = result.get("payload", {})
    emotion = payload.get("emotion")
    route = payload.get("route")
    backend = payload.get("used_backend")
    backend_error = payload.get("backend_error")
    if emotion:
        print(f"[{timestamp}] emotion={emotion}")
    if route:
        print(f"route={route} backend={backend}")
    if backend_error:
        print(f"backend_error={backend_error}")
    if result.get("should_speak") and result.get("response_text"):
        print(f"teacher: {result['response_text']}")
    else:
        print(f"teacher: ... ({result.get('reason')})")


if __name__ == "__main__":
    raise SystemExit(main())
