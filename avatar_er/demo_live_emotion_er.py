from __future__ import annotations

import argparse
import json

from robophone.emotion_rt import EmotionCameraProvider, EmotionRTConfig

from .coordinator import AvatarLiveCoordinator
from .decision import AvatarDecisionEngine
from .state import AvatarSessionStore


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live emotion -> ER debug loop.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--current-task", default="live RoboPhone session")
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    provider = EmotionCameraProvider(
        EmotionRTConfig(
            camera_index=args.camera_index,
            resolution=(args.width, args.height),
            model_path=args.model_path,
        )
    )
    coordinator = AvatarLiveCoordinator(
        engine=AvatarDecisionEngine(store=AvatarSessionStore()),
        emotion_provider=provider,
        current_task=args.current_task,
    )
    try:
        coordinator.run_debug_loop(on_result=lambda result: print(json.dumps(result)))
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
