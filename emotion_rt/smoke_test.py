from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from .config import EmotionRTConfig
from .provider import EmotionCameraProvider


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Smoke tests for EfficientFace checkpoints and live camera.")
    parser.add_argument(
        "--backend-type",
        default="hf_vit",
        choices=["hf_vit", "efficientface_pytorch", "efficientface_torchscript"],
    )
    parser.add_argument("--model-id", default="mo-thecreator/vit-Facial-Expression-Recognition")
    parser.add_argument("--model-path", default="emotion_rt/models/Pretrained_EfficientFace.tar")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    parser.add_argument("--image-path")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--camera", action="store_true")
    return parser


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
    args = build_arg_parser().parse_args()
    config = EmotionRTConfig(
        backend_type=args.backend_type,
        model_path=args.model_path,
        model_id=args.model_id,
        device=args.device,
    )

    provider_factory = EmotionCameraProvider.__new__(EmotionCameraProvider)
    backend = provider_factory._build_backend(config)

    result: dict[str, object] = {
        "status": "checkpoint_loaded",
        "backend_type": args.backend_type,
        "model_path": str(Path(args.model_path).resolve()),
        "model_id": args.model_id,
        "device": getattr(backend, "device", args.device),
        "labels": getattr(backend, "emotion_labels", config.emotion_labels),
    }

    if args.image_path:
        import cv2

        image = cv2.imread(args.image_path)
        if image is None:
            raise RuntimeError(f"Could not read image at {args.image_path}")
        prediction = backend.predict(image)
        result["image_prediction"] = {
            "emotion": prediction.emotion,
            "confidence": prediction.confidence,
        }

    if args.camera:
        provider = EmotionCameraProvider(
            EmotionRTConfig(
                camera_index=args.camera_index,
                resolution=(args.width, args.height),
                backend_type=args.backend_type,
                model_path=args.model_path,
                model_id=args.model_id,
                device=args.device,
            ),
            backend=backend,
        )
        try:
            signal = None
            for _ in range(10):
                signal = provider.get_latest()
                if signal is not None:
                    break
            result["camera_signal"] = signal.to_dict() if signal is not None else None
        finally:
            provider.close()

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
