from __future__ import annotations

import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path

import torch

from robophone.emotion_rt.backends import EfficientFaceCheckpointBackend
from robophone.emotion_rt.model import efficient_face


class EfficientFaceCheckpointBackendTests(unittest.TestCase):
    def test_missing_file_raises_clear_error(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "checkpoint not found"):
            EfficientFaceCheckpointBackend(
                model_path="/tmp/does-not-exist.tar",
                emotion_labels=["neutral", "happy", "sad", "surprise", "fear", "disgust", "angry"],
            )

    def test_unsupported_checkpoint_shape_raises_clear_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "bad.tar"
            torch.save({"foo": "bar"}, path)
            with self.assertRaisesRegex(RuntimeError, "Unsupported EfficientFace checkpoint structure"):
                EfficientFaceCheckpointBackend(
                    model_path=str(path),
                    emotion_labels=["neutral", "happy", "sad", "surprise", "fear", "disgust", "angry"],
                )

    def test_classifier_size_mismatch_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "bad_head.tar"
            model = efficient_face(num_classes=12666)
            torch.save({"state_dict": {f"module.{k}": v for k, v in model.state_dict().items()}}, path)
            with self.assertRaisesRegex(RuntimeError, "Expected 7, got 12666"):
                EfficientFaceCheckpointBackend(
                    model_path=str(path),
                    emotion_labels=["neutral", "happy", "sad", "surprise", "fear", "disgust", "angry"],
                )

    def test_valid_state_dict_loads_and_preprocesses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "good.tar"
            model = efficient_face(num_classes=7)
            torch.save({"state_dict": {f"module.{k}": v for k, v in model.state_dict().items()}}, path)
            backend = EfficientFaceCheckpointBackend(
                model_path=str(path),
                emotion_labels=["neutral", "happy", "sad", "surprise", "fear", "disgust", "angry"],
                device="cpu",
            )
            import numpy as np
            fake_cv2 = SimpleNamespace(
                COLOR_BGR2RGB=1,
                INTER_LINEAR=1,
                cvtColor=lambda image, _: image[:, :, ::-1],
                resize=lambda image, size, interpolation=None: np.ones((size[1], size[0], 3), dtype="float32"),
            )
            with patch.dict("sys.modules", {"cv2": fake_cv2}):
                tensor = backend._preprocess(np.ones((224, 224, 3), dtype="uint8"))
                self.assertEqual(tuple(tensor.shape), (1, 3, 224, 224))


if __name__ == "__main__":
    unittest.main()
