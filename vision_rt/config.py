"""Configuration for webcam-based real-time vision evaluation."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class VisionRTConfig:
    """Runtime configuration for demo and benchmark modes."""

    camera_index: int = 0
    resolution: tuple[int, int] = (640, 480)
    enable_face_refine: bool = False
    enable_overlay: bool = True
    benchmark_frame_limit: int = 300
    model_name: str = "yolov8n.pt"
    confidence_threshold: float = 0.25
    iou_threshold: float = 0.45
    usb_low_latency: bool = True
    camera_backend: int | None = None
