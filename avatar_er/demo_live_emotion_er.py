from __future__ import annotations

import argparse
import json
from datetime import datetime

try:
    from robophone.emotion_rt import EmotionCameraProvider, EmotionRTConfig
except ImportError:  # pragma: no cover - support running from inside robophone/
    from emotion_rt import EmotionCameraProvider, EmotionRTConfig

from .adapters import GeminiEmotionResponseProvider
from .coordinator import AvatarLiveCoordinator
from .decision import AvatarDecisionEngine
from .state import AvatarSessionStore


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
    coordinator = AvatarLiveCoordinator(
        engine=AvatarDecisionEngine(
            store=AvatarSessionStore(),
            emotion_response_provider=GeminiEmotionResponseProvider(),
        ),
        emotion_provider=provider,
        current_task=args.current_task,
    )
    try:
        coordinator.run_debug_loop(on_result=_print_terminal_event)
    except KeyboardInterrupt:
        return 0


def _print_terminal_event(result: dict) -> None:
    emotion = result.get("payload", {}).get("emotion")
    if emotion is None:
        return
    timestamp = datetime.now().strftime("%H:%M:%S")
    reason = result.get("reason")
    lines = [f"[{timestamp}] emotion={emotion}"]
    if result.get("should_speak") and result.get("response_text"):
        lines.append(f"teacher: {result['response_text']}")
    else:
        lines.append(f"teacher: ... ({reason})")
    print("\n".join(lines))


if __name__ == "__main__":
    raise SystemExit(main())
