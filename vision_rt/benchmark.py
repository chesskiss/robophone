"""Benchmark the webcam pipeline over a fixed number of frames."""

from __future__ import annotations

import argparse
import statistics
import sys

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
    parser = argparse.ArgumentParser(description="Benchmark webcam vision latency.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--frames", type=int, default=300)
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--face-refine-enabled", action="store_true")
    parser.add_argument("--overlay-enabled", action="store_true")
    return parser


def run_benchmark(config: VisionRTConfig) -> int:
    import cv2

    camera = open_camera(config)
    detector = YoloV8Detector(
        model_name=config.model_name,
        confidence_threshold=config.confidence_threshold,
        iou_threshold=config.iou_threshold,
    )
    face_refiner = FaceRefiner(config.enable_face_refine) if config.enable_face_refine else None

    inference_samples: list[float] = []
    total_samples: list[float] = []
    bbox_iou_samples: list[float] = []
    outline_jitter_samples: list[float] = []
    prev_detection: Detection | None = None
    prev_outline: FaceOutline | None = None

    try:
        for _ in range(config.benchmark_frame_limit):
            ok, frame = camera.read()
            if not ok:
                print("Camera read failed during benchmark.", file=sys.stderr)
                return 1

            frame_result = process_frame(
                frame=frame,
                detector=detector,
                face_refiner=face_refiner,
                overlay_enabled=config.enable_overlay,
                prev_detection=prev_detection,
                prev_outline=prev_outline,
                fps=0.0,
            )
            inference_samples.append(frame_result.inference_time_ms)
            total_samples.append(frame_result.total_frame_time_ms)
            if frame_result.bbox_iou is not None:
                bbox_iou_samples.append(frame_result.bbox_iou)
            if frame_result.outline_jitter_px is not None:
                outline_jitter_samples.append(frame_result.outline_jitter_px)

            if config.enable_overlay:
                cv2.imshow("vision_rt benchmark", frame_result.display_frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            prev_detection = frame_result.detection
            prev_outline = frame_result.face_outline

        if not total_samples:
            print("No frames were processed.", file=sys.stderr)
            return 1

        avg_total = statistics.fmean(total_samples)
        avg_inference = statistics.fmean(inference_samples)
        print(f"avg FPS: {1000.0 / avg_total:.2f}")
        print(f"avg inference time: {avg_inference:.2f} ms")
        print(f"avg total latency: {avg_total:.2f} ms")
        print(f"min latency: {min(total_samples):.2f} ms")
        print(f"max latency: {max(total_samples):.2f} ms")
        if bbox_iou_samples:
            print(f"avg bbox IoU stability: {statistics.fmean(bbox_iou_samples):.3f}")
        if outline_jitter_samples:
            print(f"avg outline jitter: {statistics.fmean(outline_jitter_samples):.2f} px")
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
        enable_overlay=args.overlay_enabled,
        benchmark_frame_limit=args.frames,
        model_name=args.model,
    )
    return run_benchmark(config)


if __name__ == "__main__":
    raise SystemExit(main())
