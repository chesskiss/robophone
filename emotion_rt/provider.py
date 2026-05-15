from __future__ import annotations

import logging
import time
from collections import Counter, deque
from statistics import mean

try:
    from robophone.avatar_er.models import EmotionSignal
    from robophone.vision_rt.config import VisionRTConfig
    from robophone.vision_rt.face_refine import FaceRefiner
    from robophone.vision_rt.pipeline import open_camera
except ImportError:  # pragma: no cover - support running from inside robophone/
    from avatar_er.models import EmotionSignal
    from vision_rt.config import VisionRTConfig
    from vision_rt.face_refine import FaceRefiner
    from vision_rt.pipeline import open_camera

from .backends import (
    EfficientFaceCheckpointBackend,
    HuggingFaceViTEmotionBackend,
    TorchscriptEfficientFaceBackend,
)
from .config import EmotionRTConfig

LOGGER = logging.getLogger(__name__)


class EmotionCameraProvider:
    """Camo-compatible live emotion provider using existing vision_rt camera access."""

    def __init__(self, config: EmotionRTConfig, backend: object | None = None) -> None:
        self.config = config
        self.backend = backend or self._build_backend(config)
        LOGGER.info(
            "EmotionCameraProvider starting backend=%s camera_index=%s resolution=%s model_path=%s model_id=%s labels=%s",
            config.backend_type,
            config.camera_index,
            config.resolution,
            config.model_path,
            config.model_id,
            config.emotion_labels,
        )
        self._camera = open_camera(
            VisionRTConfig(
                camera_index=config.camera_index,
                resolution=config.resolution,
                usb_low_latency=config.usb_low_latency,
                camera_backend=config.camera_backend,
            )
        )
        self._face_refiner = FaceRefiner(enabled=False, prefer_face_box=True)
        self._history: deque[tuple[str, float]] = deque(maxlen=config.stability_window)

    def get_latest(self) -> EmotionSignal | None:
        ok, frame = self._camera.read()
        if not ok:
            return None

        face_box = self._face_refiner.detect_face(frame)
        if face_box is None:
            self._history.clear()
            return None

        x1, y1, x2, y2 = face_box.bbox_xyxy
        face_crop = frame[max(0, y1) : max(0, y2), max(0, x1) : max(0, x2)]
        if face_crop.size == 0:
            return None

        prediction = self.backend.predict(face_crop)
        self._history.append((prediction.emotion, prediction.confidence))
        stable_label, stable_count, stable_confidence, history_size = self._stability_vote()
        is_stable = (
            stable_label is not None
            and history_size > 0
            and stable_count > (history_size / 2.0)
            and stable_confidence >= self.config.confidence_threshold
            and stable_count >= self.config.min_stable_count
        )
        emitted_emotion = stable_label if is_stable else prediction.emotion
        emitted_confidence = stable_confidence if is_stable else prediction.confidence
        return EmotionSignal(
            emotion=emitted_emotion,
            confidence=emitted_confidence,
            timestamp=time.time(),
            face_bbox=(x1, y1, x2, y2),
            source="robophone.emotion_rt",
            source_face_id="primary_face",
            is_stable=is_stable,
        )

    def close(self) -> None:
        self._camera.release()
        self._face_refiner.close()

    def _stability_vote(self) -> tuple[str | None, int, float, int]:
        if not self._history:
            return None, 0, 0.0, 0
        labels = [label for label, _ in self._history]
        counter = Counter(labels)
        label, count = counter.most_common(1)[0]
        label_confidences = [confidence for candidate_label, confidence in self._history if candidate_label == label]
        return label, count, float(mean(label_confidences)), len(self._history)

    def _build_backend(self, config: EmotionRTConfig) -> object:
        if config.backend_type == "hf_vit":
            return HuggingFaceViTEmotionBackend(
                model_id=config.model_id,
                device=config.device,
            )
        if config.backend_type == "efficientface_torchscript" or config.checkpoint_format == "torchscript":
            return TorchscriptEfficientFaceBackend(
                model_path=config.model_path,
                emotion_labels=config.emotion_labels,
                input_size=config.input_size,
                device=config.device,
            )
        return EfficientFaceCheckpointBackend(
            model_path=config.model_path,
            emotion_labels=config.emotion_labels,
            input_size=config.input_size,
            num_classes=config.num_classes,
            device=config.device,
            checkpoint_format=config.checkpoint_format,
        )
