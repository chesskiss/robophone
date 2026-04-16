"""YOLOv8n detector wrapper with isolated model inference timing."""

from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass(slots=True)
class Detection:
    class_id: int
    class_name: str
    confidence: float
    xyxy: tuple[float, float, float, float]


@dataclass(slots=True)
class DetectionResult:
    detections: list[Detection]
    inference_time_ms: float


class YoloV8Detector:
    """Thin Ultralytics YOLOv8n wrapper for webcam evaluation."""

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
    ) -> None:
        try:
            import torch
            from ultralytics import YOLO
            from ultralytics.utils import ops
            try:
                from ultralytics.utils.nms import non_max_suppression
            except ImportError:
                non_max_suppression = ops.non_max_suppression
        except ImportError as exc:
            raise RuntimeError(
                "YOLOv8n requires `ultralytics` and `torch`. "
                "Install them before running vision_rt."
            ) from exc

        self._torch = torch
        self._ops = ops
        self._non_max_suppression = non_max_suppression
        self._model = YOLO(model_name)
        self._raw_model = self._model.model
        self._raw_model.eval()
        self._confidence_threshold = confidence_threshold
        self._iou_threshold = iou_threshold
        self._device = next(self._raw_model.parameters()).device
        self._names = self._model.names

    def _preprocess(self, frame_bgr):
        import cv2
        import numpy as np

        image = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(image, (640, 640), interpolation=cv2.INTER_LINEAR)
        tensor = self._torch.from_numpy(np.ascontiguousarray(resized)).to(self._device)
        tensor = tensor.permute(2, 0, 1).float() / 255.0
        tensor = tensor.unsqueeze(0)
        return tensor

    def detect(self, frame_bgr) -> DetectionResult:
        tensor = self._preprocess(frame_bgr)

        with self._torch.inference_mode():
            start = time.perf_counter()
            raw_output = self._raw_model.forward(tensor)
            if self._device.type == "cuda":
                self._torch.cuda.synchronize(self._device)
            inference_time_ms = (time.perf_counter() - start) * 1000.0

        predictions = raw_output[0] if isinstance(raw_output, (list, tuple)) else raw_output
        predictions = predictions.clone()
        nms_output = self._non_max_suppression(
            predictions,
            conf_thres=self._confidence_threshold,
            iou_thres=self._iou_threshold,
            classes=[0],
            max_det=10,
        )

        detections: list[Detection] = []
        if nms_output and len(nms_output[0]) > 0:
            scaled_boxes = nms_output[0].clone()
            scaled_boxes[:, :4] = self._ops.scale_boxes(
                tensor.shape[2:],
                scaled_boxes[:, :4],
                frame_bgr.shape,
            ).round()
            for box in scaled_boxes:
                class_id = int(box[5].item())
                detections.append(
                    Detection(
                        class_id=class_id,
                        class_name=str(self._names[class_id]),
                        confidence=float(box[4].item()),
                        xyxy=tuple(float(value) for value in box[:4].tolist()),
                    )
                )

        return DetectionResult(detections=detections, inference_time_ms=inference_time_ms)
