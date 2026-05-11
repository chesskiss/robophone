from __future__ import annotations

import argparse
import json
import logging

from .config import EmotionRTConfig
from .provider import EmotionCameraProvider


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live Camo-compatible emotion detection demo.")
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
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    parser.add_argument("--camera-only", action="store_true")
    return parser


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    args = build_arg_parser().parse_args()
    if args.camera_only:
        try:
            from robophone.vision_rt.config import VisionRTConfig
            from robophone.vision_rt.pipeline import open_camera
        except ImportError:  # pragma: no cover - support running from inside robophone/
            from vision_rt.config import VisionRTConfig
            from vision_rt.pipeline import open_camera

        camera = open_camera(
            VisionRTConfig(
                camera_index=args.camera_index,
                resolution=(args.width, args.height),
            )
        )
        try:
            ok, frame = camera.read()
            if not ok:
                raise RuntimeError("Camera opened but no frame could be read.")
            print(
                json.dumps(
                    {
                        "status": "ok",
                        "camera_index": args.camera_index,
                        "frame_shape": list(frame.shape),
                    }
                )
            )
            return 0
        finally:
            camera.release()

    provider = EmotionCameraProvider(
        EmotionRTConfig(
            camera_index=args.camera_index,
            resolution=(args.width, args.height),
            backend_type=args.backend_type,
            model_path=args.model_path,
            model_id=args.model_id,
            device=args.device,
        )
    )
    try:
        while True:
            signal = provider.get_latest()
            if signal is not None:
                print(json.dumps(signal.to_dict()))
    except KeyboardInterrupt:
        return 0
    finally:
        provider.close()


if __name__ == "__main__":
    raise SystemExit(main())
