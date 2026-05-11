from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(slots=True)
class EmotionRTConfig:
    camera_index: int = 0
    resolution: tuple[int, int] = (640, 480)
    camera_backend: int | None = None
    usb_low_latency: bool = True
    backend_type: Literal["hf_vit", "efficientface_pytorch", "efficientface_torchscript"] = "hf_vit"
    model_path: str = "emotion_rt/models/Pretrained_EfficientFace.tar"
    model_id: str = "mo-thecreator/vit-Facial-Expression-Recognition"
    checkpoint_format: Literal["auto", "pytorch", "torchscript"] = "auto"
    input_size: int = 224
    num_classes: int = 7
    device: Literal["auto", "cpu", "cuda"] = "auto"
    confidence_threshold: float = 0.55
    stability_window: int = 5
    min_stable_count: int = 3
    emotion_labels: list[str] = field(
        default_factory=lambda: [
            "angry",
            "disgust",
            "fear",
            "happy",
            "sad",
            "surprise",
            "neutral",
        ]
    )
