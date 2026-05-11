# RoboPhone Avatar ER Core

This module now implements the ER orchestration layer only. Specialist capabilities live outside ER and are called through provider interfaces.

## Architecture

The design follows:

`Detect -> Interpret -> Decide -> Call specialist module if needed -> Respond -> Update state -> Repeat`

Modules:

- `models.py`: ER-facing contracts and state models.
- `state.py`: Persistent in-memory avatar session state store with bounded history.
- `commands.py`: Deterministic control-command interpreter. Critical mute and responsiveness commands do not depend on an LLM.
- `intent.py`: Heuristic intent classifier with a clean swap point for a future ML or LLM classifier.
- `decision.py`: Central ER orchestration layer.
- `providers.py`: Provider contracts for emotion, speech, manual-Q&A, and motion modules.
- `adapters.py`: Thin adapters that call external modules such as `robophone/stt` and `robophone/ground_eval`.
- `coordinator.py`: Live polling coordinator for camera and mic driven demos.
- `response.py`: Response formatting for tone and responsiveness modes.
- `api.py`: Public integration entry point.
- `demo.py`: Pure ER simulation script.
- `demo_live_emotion_er.py`: live Camo emotion input into ER.
- `demo_live_emotion_stt.py`: live Camo emotion plus STT into ER.
- `demo_live_full.py`: live Camo emotion plus STT plus grounded Q&A.

## Data Flow

1. External code sends a perception payload to `process_avatar_input(perception_payload)`.
2. Payload is normalized into `PerceptionInput`.
3. Speech text is checked by the rule-based command interpreter and intent classifier.
4. The decision engine decides whether to stay quiet, confirm a settings change, call a manual-Q&A provider, or offer proactive help.
5. Specialist modules stay outside ER:
   - `robophone/emotion_rt` detects emotions.
   - `robophone/stt` transcribes speech.
   - `robophone/ground_eval` answers RoboPhone manual questions at runtime.
6. Response formatting adjusts verbosity and tone.
7. Updated avatar state is persisted in memory and returned to the caller.

## Public API

```python
from avatar_er import process_avatar_input

result = process_avatar_input(
    {
        "emotion_signal": {
            "emotion": "confused",
            "confidence": 0.82,
            "source": "robophone.emotion_rt",
            "source_face_id": "student_1",
            "is_stable": True,
        },
        "speech_signal": {
            "text": "I don't understand how to graph sin",
            "source": "robophone.stt",
        },
        "current_task": "building RoboPhone Blockly graph",
    }
)
```

Returned shape:

```python
{
    "should_speak": True,
    "response_text": "No problem. Start with ...",
    "updated_state": {...},
    "action_type": "manual_guidance",
    "reason": "...",
    "payload": {...},
}
```

## Demo

Run:

```bash
python3 -m avatar_er.demo
```

The demo simulates:

- no voice with a confused face
- `"stop responding"`
- `"talk less"`
- `"I don't understand how to graph sin"`
- `"how do I display text on the LCD?"`
- neutral face with no speech

The pure demo uses a local mock manual-Q&A provider so it never requires a real LLM call.

## Live Demos

Emotion-only into ER:

```bash
./.venv/bin/python -m avatar_er.demo_live_emotion_er \
  --camera-index 0 \
  --model-path /absolute/path/to/efficientface.torchscript.pt
```

Emotion plus STT:

```bash
./.venv/bin/python -m avatar_er.demo_live_emotion_stt \
  --camera-index 0 \
  --model-path /absolute/path/to/efficientface.torchscript.pt \
  --stt-api-url http://localhost:8001/transcribe
```

Full loop with grounded Q&A:

```bash
./.venv/bin/python -m avatar_er.demo_live_full \
  --camera-index 0 \
  --model-path /absolute/path/to/efficientface.torchscript.pt \
  --stt-api-url http://localhost:8001/transcribe
```

## Runtime Manual-Q&A Integration

`GroundEvalManualQaProvider` calls the new `robophone.ground_eval.runtime` service layer.

ER stays responsible for:

- whether to respond
- how much to say
- tone and cooldown enforcement

`ground_eval` stays responsible for:

- grounding the question against the RoboPhone manual
- returning answer content

## What Is Stubbed or Mocked

- The repo does not currently include EfficientFace weights. Provide a local TorchScript checkpoint path for live emotion demos.
- Unit tests use mock manual-Q&A backends and fake clocks.

## Running Tests

```bash
python3 -m unittest discover -s avatar_er/tests -p 'test_*.py'
python3 -m unittest discover -s emotion_rt/tests -p 'test_*.py'
python3 -m unittest ground_eval.test_runtime
```

## Next Steps

- Tune EfficientFace checkpoint loading once the chosen model export is fixed.
- Optionally add phone-audio input after the Mac-mic STT loop is stable.
- Replace the heuristic intent layer when the live demo behavior is stable enough to justify it.
