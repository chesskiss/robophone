from __future__ import annotations

import argparse

import torch

from .backends import EfficientFaceCheckpointBackend
from .config import EmotionRTConfig


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export a working EfficientFace checkpoint to TorchScript.")
    parser.add_argument("--model-path", default="emotion_rt/models/Pretrained_EfficientFace.tar")
    parser.add_argument("--output-path", required=True)
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    config = EmotionRTConfig()
    backend = EfficientFaceCheckpointBackend(
        model_path=args.model_path,
        emotion_labels=config.emotion_labels,
        input_size=config.input_size,
        num_classes=config.num_classes,
        device=args.device,
    )
    example = torch.randn(1, 3, config.input_size, config.input_size, device=backend.device)
    traced = torch.jit.trace(backend._model, example)
    traced.save(args.output_path)
    print(args.output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
