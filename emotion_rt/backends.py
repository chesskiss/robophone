from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .model import efficient_face

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class EmotionPrediction:
    emotion: str
    confidence: float
    logits: list[float]


class HuggingFaceViTEmotionBackend:
    """Loads a Hugging Face ViT facial-expression model and uses its label mapping."""

    def __init__(self, model_id: str, device: str = "auto") -> None:
        self.model_id = model_id
        try:
            import torch
        except ImportError as exc:
            raise RuntimeError("Emotion inference requires torch.") from exc
        try:
            from transformers import AutoImageProcessor, AutoModelForImageClassification
        except ImportError as exc:
            raise RuntimeError(
                "The Hugging Face ViT backend requires `transformers`. "
                "Install it in `robophone/.venv` before running emotion_rt."
            ) from exc

        self._torch = torch
        self.device = resolve_device(device)
        self._processor = AutoImageProcessor.from_pretrained(model_id)
        self._model = AutoModelForImageClassification.from_pretrained(model_id)
        self._model.to(self.device)
        self._model.eval()
        id2label = getattr(self._model.config, "id2label", {}) or {}
        self.emotion_labels = [self._normalize_label(id2label[index]) for index in sorted(id2label)]
        LOGGER.info(
            "Loaded Hugging Face ViT emotion model id=%s device=%s labels=%s",
            model_id,
            self.device,
            self.emotion_labels,
        )

    def predict(self, face_bgr) -> EmotionPrediction:
        from PIL import Image
        import cv2

        rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        image = Image.fromarray(rgb)
        encoded = self._processor(images=image, return_tensors="pt")
        encoded = {key: value.to(self.device) for key, value in encoded.items()}
        with self._torch.inference_mode():
            outputs = self._model(**encoded)
            logits = outputs.logits[0]
            probs = self._torch.softmax(logits, dim=0)
            index = int(self._torch.argmax(probs).item())
            confidence = float(probs[index].item())
        label = self.emotion_labels[index] if index < len(self.emotion_labels) else str(index)
        return EmotionPrediction(
            emotion=label,
            confidence=confidence,
            logits=[float(value) for value in probs.tolist()],
        )

    def _normalize_label(self, label: str) -> str:
        return label.strip().lower()


def resolve_device(preference: str) -> str:
    import torch

    if preference == "cpu":
        return "cpu"
    if preference == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but not available.")
        return "cuda"
    return "cuda" if torch.cuda.is_available() else "cpu"


class EfficientFaceCheckpointBackend:
    """Loads a standard PyTorch EfficientFace checkpoint from .tar or .pth."""

    def __init__(
        self,
        model_path: str,
        emotion_labels: list[str],
        input_size: int = 224,
        num_classes: int = 7,
        device: str = "auto",
        checkpoint_format: str = "auto",
    ) -> None:
        self.model_path = Path(model_path)
        self.emotion_labels = emotion_labels
        self.input_size = input_size
        self.num_classes = num_classes
        self.checkpoint_format = checkpoint_format
        if not self.model_path.exists():
            raise RuntimeError(
                f"EfficientFace checkpoint not found at {self.model_path}. "
                "Provide a real local .tar or .pth checkpoint path."
            )

        try:
            import torch
        except ImportError as exc:
            raise RuntimeError("Emotion inference requires torch.") from exc

        self._torch = torch
        self.device = resolve_device(device)
        self._model = self._load_model()
        self._model.to(self.device)
        self._model.eval()
        LOGGER.info(
            "Loaded EfficientFace checkpoint path=%s device=%s labels=%s",
            self.model_path,
            self.device,
            self.emotion_labels,
        )

    def predict(self, face_bgr) -> EmotionPrediction:
        tensor = self._preprocess(face_bgr)
        with self._torch.inference_mode():
            logits = self._model(tensor)
            probs = self._torch.softmax(logits, dim=1)[0]
            index = int(self._torch.argmax(probs).item())
            confidence = float(probs[index].item())
        label = self.emotion_labels[index] if index < len(self.emotion_labels) else str(index)
        return EmotionPrediction(
            emotion=label,
            confidence=confidence,
            logits=[float(value) for value in probs.tolist()],
        )

    def _load_model(self):
        model = efficient_face(num_classes=self.num_classes)
        checkpoint = self._load_checkpoint()
        state_dict = self._extract_state_dict(checkpoint)
        state_dict = self._strip_module_prefix(state_dict)

        fc_weight = state_dict.get("fc.weight")
        fc_bias = state_dict.get("fc.bias")
        if fc_weight is None or fc_bias is None:
            raise RuntimeError("Checkpoint is missing classifier weights for EfficientFace.")
        if fc_weight.shape[0] != self.num_classes:
            raise RuntimeError(
                "Checkpoint classifier output size does not match RAF-DB emotion classes. "
                f"Expected {self.num_classes}, got {fc_weight.shape[0]}. "
                "This looks like a backbone pretraining checkpoint rather than a 7-class RAF-DB model."
            )
        if fc_weight.shape[1] != model.fc.in_features:
            raise RuntimeError(
                "Checkpoint classifier input size does not match EfficientFace. "
                f"Expected {model.fc.in_features}, got {fc_weight.shape[1]}."
            )

        missing, unexpected = model.load_state_dict(state_dict, strict=False)
        if missing or unexpected:
            raise RuntimeError(
                "Checkpoint could not be loaded cleanly. "
                f"Missing keys: {missing}. Unexpected keys: {unexpected}."
            )
        return model

    def _load_checkpoint(self) -> Any:
        if self.checkpoint_format == "torchscript":
            raise RuntimeError("TorchScript loading is no longer the default for EfficientFace checkpoints.")
        try:
            return self._torch.load(self.model_path, map_location="cpu", weights_only=True)
        except TypeError:
            return self._torch.load(self.model_path, map_location="cpu")

    def _extract_state_dict(self, checkpoint: Any) -> dict[str, Any]:
        if isinstance(checkpoint, dict):
            if "state_dict" in checkpoint and isinstance(checkpoint["state_dict"], dict):
                return checkpoint["state_dict"]
            if "model_state_dict" in checkpoint and isinstance(checkpoint["model_state_dict"], dict):
                return checkpoint["model_state_dict"]
            if all(hasattr(value, "shape") for value in checkpoint.values()):
                return checkpoint
        raise RuntimeError(
            "Unsupported EfficientFace checkpoint structure. Expected a dict containing "
            "'state_dict', 'model_state_dict', or a raw state dict."
        )

    def _strip_module_prefix(self, state_dict: dict[str, Any]) -> dict[str, Any]:
        cleaned: dict[str, Any] = {}
        for key, value in state_dict.items():
            if key.startswith("module."):
                cleaned[key[len("module."):]] = value
            else:
                cleaned[key] = value
        return cleaned

    def _preprocess(self, face_bgr):
        import cv2
        import numpy as np

        image = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(image, (self.input_size, self.input_size), interpolation=cv2.INTER_LINEAR)
        normalized = resized.astype("float32") / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype="float32")
        std = np.array([0.229, 0.224, 0.225], dtype="float32")
        normalized = (normalized - mean) / std
        tensor = self._torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0).to(self.device)
        return tensor


class TorchscriptEfficientFaceBackend:
    """Optional TorchScript backend retained for later export workflows."""

    def __init__(self, model_path: str, emotion_labels: list[str], input_size: int = 224, device: str = "auto") -> None:
        self.model_path = Path(model_path)
        self.emotion_labels = emotion_labels
        self.input_size = input_size
        if not self.model_path.exists():
            raise RuntimeError(
                f"EfficientFace TorchScript model file not found at {self.model_path}. "
                "Provide a local TorchScript checkpoint path."
            )

        try:
            import torch
        except ImportError as exc:
            raise RuntimeError("Emotion inference requires torch.") from exc

        self._torch = torch
        self.device = resolve_device(device)
        self._model = torch.jit.load(str(self.model_path), map_location=self.device)
        self._model.eval()

    def predict(self, face_bgr) -> EmotionPrediction:
        tensor = self._preprocess(face_bgr)
        with self._torch.inference_mode():
            logits = self._model(tensor)
            if isinstance(logits, (list, tuple)):
                logits = logits[0]
            probs = self._torch.softmax(logits, dim=1)[0]
            index = int(self._torch.argmax(probs).item())
            confidence = float(probs[index].item())
        label = self.emotion_labels[index] if index < len(self.emotion_labels) else str(index)
        return EmotionPrediction(
            emotion=label,
            confidence=confidence,
            logits=[float(value) for value in probs.tolist()],
        )

    def _preprocess(self, face_bgr):
        import cv2
        import numpy as np

        image = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(image, (self.input_size, self.input_size), interpolation=cv2.INTER_LINEAR)
        normalized = resized.astype("float32") / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype="float32")
        std = np.array([0.229, 0.224, 0.225], dtype="float32")
        normalized = (normalized - mean) / std
        tensor = self._torch.from_numpy(normalized).permute(2, 0, 1).unsqueeze(0).to(self.device)
        return tensor


class MockEmotionBackend:
    def __init__(self, emotion: str = "neutral", confidence: float = 0.8) -> None:
        self.emotion = emotion
        self.confidence = confidence

    def predict(self, face_bgr) -> EmotionPrediction:
        return EmotionPrediction(
            emotion=self.emotion,
            confidence=self.confidence,
            logits=[],
        )
