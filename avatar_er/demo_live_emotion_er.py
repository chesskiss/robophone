from __future__ import annotations

import argparse
import time
from datetime import datetime
from pathlib import Path

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
from .state import AvatarSessionStore, JsonAvatarSessionStore


DEFAULT_SESSION_PATH = Path(__file__).resolve().parent / "state" / "live_session.json"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live emotion -> ER debug loop.")
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
    parser.add_argument("--session-path", default=str(DEFAULT_SESSION_PATH))
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    store = _build_store(args.session_path)
    provider = EmotionCameraProvider(
        EmotionRTConfig(
            camera_index=args.camera_index,
            resolution=(args.width, args.height),
            backend_type=args.backend_type,
            model_id=args.model_id,
            model_path=args.model_path,
        )
    )
    coordinator = AvatarLiveCoordinator(
        engine=AvatarDecisionEngine(
            store=store,
            manual_qa_provider=GroundEvalManualQaProvider(),
            emotion_response_provider=GeminiEmotionResponseProvider(),
            conversation_route_provider=GeminiConversationRouteProvider(),
            conversation_response_provider=GeminiConversationResponseProvider(),
        ),
        emotion_provider=provider,
        current_task=args.current_task,
    )
    try:
        print("emotion terminal: publishing stable emotions and answering queued child inputs.")
        while True:
            for result in coordinator.process_next_events():
                _print_terminal_event(result)
            for pending in store.pop_pending_child_inputs():
                result = coordinator.engine.process(
                    {
                        "speech_text": pending.get("text"),
                        "input_source": pending.get("source") or "typed_input",
                        "current_task": args.current_task,
                    }
                )
                _print_terminal_event(result)
            time.sleep(0.2)
    except KeyboardInterrupt:
        return 0
    finally:
        provider.close()


def _print_terminal_event(result: dict) -> None:
    payload = result.get("payload", {})
    emotion = payload.get("emotion")
    route = payload.get("route")
    backend = payload.get("used_backend")
    backend_error = payload.get("backend_error")
    timestamp = datetime.now().strftime("%H:%M:%S")
    reason = result.get("reason")
    lines = [f"[{timestamp}] action={result.get('action_type')}"]
    if emotion is not None:
        lines.append(f"emotion={emotion}")
    if route:
        lines.append(f"route={route} backend={backend}")
    if backend_error:
        lines.append(f"backend_error={backend_error}")
    if result.get("should_speak") and result.get("response_text"):
        lines.append(f"teacher: {result['response_text']}")
    else:
        lines.append(f"teacher: ... ({reason})")
    print("\n".join(lines))


def _build_store(session_path: str | None) -> AvatarSessionStore:
    if not session_path:
        return AvatarSessionStore()
    return JsonAvatarSessionStore(session_path=session_path)


if __name__ == "__main__":
    raise SystemExit(main())
