from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import torch

from robophone.emotion_rt.backends import HuggingFaceViTEmotionBackend


class FakeProcessor:
    @classmethod
    def from_pretrained(cls, model_id):
        return cls()

    def __call__(self, images, return_tensors="pt"):
        return {"pixel_values": torch.ones((1, 3, 224, 224))}


class FakeModel:
    def __init__(self):
        self.config = SimpleNamespace(
            id2label={
                0: "Angry",
                1: "Disgust",
                2: "Fear",
                3: "Happy",
                4: "Sad",
                5: "Surprise",
                6: "Neutral",
            }
        )

    @classmethod
    def from_pretrained(cls, model_id):
        return cls()

    def to(self, device):
        return self

    def eval(self):
        return self

    def __call__(self, **encoded):
        logits = torch.tensor([[0.1, 0.1, 0.1, 2.0, 0.1, 0.1, 0.1]], dtype=torch.float32)
        return SimpleNamespace(logits=logits)


class HuggingFaceBackendTests(unittest.TestCase):
    def test_hf_backend_uses_model_labels(self) -> None:
        fake_transformers = SimpleNamespace(
            AutoImageProcessor=FakeProcessor,
            AutoModelForImageClassification=FakeModel,
        )
        fake_cv2 = SimpleNamespace(COLOR_BGR2RGB=1, cvtColor=lambda image, _: image[:, :, ::-1])
        with patch.dict("sys.modules", {"transformers": fake_transformers, "cv2": fake_cv2}):
            backend = HuggingFaceViTEmotionBackend(
                "mo-thecreator/vit-Facial-Expression-Recognition",
                device="cpu",
            )
            import numpy as np

            prediction = backend.predict(np.ones((10, 10, 3), dtype="uint8"))
            self.assertEqual(prediction.emotion, "happy")
            self.assertGreater(prediction.confidence, 0.5)


if __name__ == "__main__":
    unittest.main()
