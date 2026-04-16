"""Live webcam demo for real-time detector evaluation."""

from __future__ import annotations

import argparse

try:
    from .config import VisionRTConfig
    from .detector import Detection, YoloV8Detector
    from .face_refine import FaceOutline, FaceRefiner
    from .pipeline import open_camera, process_frame
except ImportError:  # pragma: no cover - support direct script execution
    from config import VisionRTConfig
    from detector import Detection, YoloV8Detector
    from face_refine import FaceOutline, FaceRefiner
    from pipeline import open_camera, process_frame


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Live webcam vision demo.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--face-refine-enabled", action="store_true")
    parser.add_argument("--no-overlay", action="store_true")
    return parser


def run_demo(config: VisionRTConfig) -> int:
    import cv2

    camera = open_camera(config)
    detector = YoloV8Detector(
        model_name=config.model_name,
        confidence_threshold=config.confidence_threshold,
        iou_threshold=config.iou_threshold,
    )
    face_refiner = FaceRefiner(config.enable_face_refine) if config.enable_face_refine else None

    prev_detection: Detection | None = None
    prev_outline: FaceOutline | None = None
    prev_total_ms = 0.0

    try:
        while True:
            ok, frame = camera.read()
            if not ok:
                return 1

            fps = 1000.0 / prev_total_ms if prev_total_ms > 0 else 0.0
            frame_result = process_frame(
                frame=frame,
                detector=detector,
                face_refiner=face_refiner,
                overlay_enabled=config.enable_overlay,
                prev_detection=prev_detection,
                prev_outline=prev_outline,
                fps=fps,
            )
            cv2.imshow("vision_rt demo", frame_result.display_frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

            prev_total_ms = frame_result.total_frame_time_ms
            prev_detection = frame_result.detection
            prev_outline = frame_result.face_outline
        return 0
    finally:
        camera.release()
        if face_refiner is not None:
            face_refiner.close()
        cv2.destroyAllWindows()


def main() -> int:
    args = build_arg_parser().parse_args()
    config = VisionRTConfig(
        camera_index=args.camera_index,
        resolution=(args.width, args.height),
        enable_face_refine=args.face_refine_enabled,
        enable_overlay=not args.no_overlay,
        model_name=args.model,
    )
    return run_demo(config)


if __name__ == "__main__":
    raise SystemExit(main())
