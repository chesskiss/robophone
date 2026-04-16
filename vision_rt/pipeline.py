"""Shared webcam loop helpers for demo and benchmark modes."""

from __future__ import annotations

import time
from dataclasses import dataclass

try:
    from .config import VisionRTConfig
    from .detector import Detection, YoloV8Detector
    from .distance import DistanceEstimate, estimate_distance_from_box
    from .face_refine import FaceOutline, FaceRefiner
except ImportError:  # pragma: no cover - support direct script execution
    from config import VisionRTConfig
    from detector import Detection, YoloV8Detector
    from distance import DistanceEstimate, estimate_distance_from_box
    from face_refine import FaceOutline, FaceRefiner


@dataclass(slots=True)
class FrameMetrics:
    inference_time_ms: float
    total_frame_time_ms: float
    latency_min_ms: float
    latency_max_ms: float


@dataclass(slots=True)
class FrameResult:
    frame: object
    display_frame: object
    detection: Detection | None
    distance: DistanceEstimate | None
    face_outline: FaceOutline | None
    inference_time_ms: float
    total_frame_time_ms: float
    bbox_iou: float | None
    outline_jitter_px: float | None


def open_camera(config: VisionRTConfig):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError(
            "OpenCV is required for webcam capture. Install `opencv-python`."
        ) from exc

    if config.camera_backend is None:
        capture = cv2.VideoCapture(config.camera_index)
    else:
        capture = cv2.VideoCapture(config.camera_index, config.camera_backend)

    if not capture.isOpened():
        raise RuntimeError(
            f"Could not open camera index {config.camera_index}. "
            "Check the Camo device index and connection state."
        )

    width, height = config.resolution
    capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if config.usb_low_latency:
        capture.set(cv2.CAP_PROP_FPS, 60)

    return capture


def select_primary_detection(detections: list[Detection]) -> Detection | None:
    if not detections:
        return None
    return max(
        detections,
        key=lambda det: (
            (det.xyxy[2] - det.xyxy[0]) * (det.xyxy[3] - det.xyxy[1]),
            det.confidence,
        ),
    )


def bbox_iou(
    box_a: tuple[float, float, float, float] | None,
    box_b: tuple[float, float, float, float] | None,
) -> float | None:
    if box_a is None or box_b is None:
        return None

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union_area = area_a + area_b - inter_area
    if union_area <= 0.0:
        return None
    return inter_area / union_area


def outline_jitter(
    prev_outline: FaceOutline | None,
    curr_outline: FaceOutline | None,
) -> float | None:
    if prev_outline is None or curr_outline is None:
        return None
    if len(prev_outline.points) != len(curr_outline.points):
        return None

    total_distance = 0.0
    for prev_point, curr_point in zip(prev_outline.points, curr_outline.points):
        dx = curr_point[0] - prev_point[0]
        dy = curr_point[1] - prev_point[1]
        total_distance += (dx * dx + dy * dy) ** 0.5
    return total_distance / max(1, len(curr_outline.points))


def annotate_frame(
    frame,
    detection: Detection | None,
    distance: DistanceEstimate | None,
    face_outline: FaceOutline | None,
    fps: float,
    inference_time_ms: float,
):
    import cv2

    if detection is not None:
        x1, y1, x2, y2 = [int(value) for value in detection.xyxy]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (40, 220, 40), 2)
        cv2.putText(
            frame,
            f"{detection.class_name} {detection.confidence:.2f}",
            (x1, max(20, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (40, 220, 40),
            2,
            cv2.LINE_AA,
        )

    if distance is not None:
        cv2.putText(
            frame,
            f"distance: {distance.label} ({distance.approx_distance_m:.1f}m)",
            (16, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 220, 40),
            2,
            cv2.LINE_AA,
        )

    cv2.putText(
        frame,
        f"fps: {fps:.1f}",
        (16, 62),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        f"inference: {inference_time_ms:.2f} ms",
        (16, 92),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2,
        cv2.LINE_AA,
    )

    if face_outline is not None and face_outline.points:
        cv2.polylines(
            frame,
            [__import__("numpy").array(face_outline.points, dtype="int32")],
            isClosed=True,
            color=(255, 120, 40),
            thickness=2,
        )

    return frame


def process_frame(
    frame,
    detector: YoloV8Detector,
    face_refiner: FaceRefiner | None,
    overlay_enabled: bool,
    prev_detection: Detection | None,
    prev_outline: FaceOutline | None,
    fps: float,
) -> FrameResult:
    frame_start = time.perf_counter()
    detection_result = detector.detect(frame)
    detection = select_primary_detection(detection_result.detections)
    face_outline = face_refiner.refine(frame) if face_refiner is not None else None
    distance = None
    if detection is not None:
        frame_height, frame_width = frame.shape[:2]
        distance = estimate_distance_from_box(detection.xyxy, (frame_width, frame_height))

    display_frame = frame
    if overlay_enabled:
        display_frame = frame.copy()
        annotate_frame(
            display_frame,
            detection=detection,
            distance=distance,
            face_outline=face_outline,
            fps=fps,
            inference_time_ms=detection_result.inference_time_ms,
        )

    total_frame_time_ms = (time.perf_counter() - frame_start) * 1000.0
    return FrameResult(
        frame=frame,
        display_frame=display_frame,
        detection=detection,
        distance=distance,
        face_outline=face_outline,
        inference_time_ms=detection_result.inference_time_ms,
        total_frame_time_ms=total_frame_time_ms,
        bbox_iou=bbox_iou(
            prev_detection.xyxy if prev_detection is not None else None,
            detection.xyxy if detection is not None else None,
        ),
        outline_jitter_px=outline_jitter(prev_outline, face_outline),
    )
