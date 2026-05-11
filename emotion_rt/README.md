# emotion_rt

`emotion_rt` is a standalone live emotion-detection module for RoboPhone.

It is separate from `avatar_er` and `vision_rt`:

- `vision_rt` remains the source of camera/Camo integration patterns.
- `emotion_rt` owns face crop extraction and emotion classification.
- `avatar_er` only consumes normalized emotion signals.

## Model expectation

This module now defaults to the Hugging Face ViT facial-expression model:

- `mo-thecreator/vit-Facial-Expression-Recognition`

That is the preferred path because it is already a 7-class emotion classifier.

EfficientFace checkpoint support remains available as a fallback, for example:

- `emotion_rt/models/Pretrained_EfficientFace.tar`

The EfficientFace fallback supports checkpoint shapes containing:

- `state_dict`
- `model_state_dict`
- raw state dicts

Important:

- the ViT backend reads labels from the model config automatically
- the EfficientFace fallback checkpoint must be a 7-class RAF-DB emotion model if you want direct emotion output
- an EfficientFace backbone pretraining checkpoint with a classifier head of `12666` classes is not enough for live emotion inference

## Operator workflow

1. Start Camo and confirm the correct webcam index.
2. For the default ViT path, install `transformers` in `robophone/.venv`.
3. Run a model smoke test.
4. Run live `emotion_rt`.
5. Run live `avatar_er` integration once the checkpoint is confirmed usable.

## Smoke tests

Checkpoint only:

```bash
./.venv/bin/python -m emotion_rt.smoke_test \
  --backend-type hf_vit \
  --model-id mo-thecreator/vit-Facial-Expression-Recognition
```

Checkpoint plus camera:

```bash
./.venv/bin/python -m emotion_rt.smoke_test \
  --backend-type hf_vit \
  --model-id mo-thecreator/vit-Facial-Expression-Recognition \
  --camera \
  --camera-index 0
```

Camera only:

```bash
./.venv/bin/python -m emotion_rt.demo \
  --camera-only \
  --camera-index 0
```

Example run:

```bash
./.venv/bin/python -m emotion_rt.demo \
  --camera-index 0 \
  --width 640 \
  --height 480 \
  --backend-type hf_vit \
  --model-id mo-thecreator/vit-Facial-Expression-Recognition
```

Optional TorchScript export from a working `.tar` or `.pth` checkpoint:

```bash
./.venv/bin/python -m emotion_rt.export_torchscript \
  --model-path emotion_rt/models/Pretrained_EfficientFace.tar \
  --output-path emotion_rt/models/efficientface.torchscript.pt
```

## Notes

- Use the pretrained ViT model first; do not train unless the live quality is clearly inadequate.
- The default backend requires `transformers`.
- If the loader reports a classifier mismatch such as `Expected 7, got 12666`, the file is a backbone pretraining checkpoint rather than a 7-class RAF-DB emotion model.
