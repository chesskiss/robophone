# RoboPhone Avatar UI

Display-only local browser avatar for the RoboPhone ER session.

This module does not run ER, Gemini, emotion detection, STT, or `ground_eval`. It only reads the shared JSON session file and renders a procedural 3D robot teacher.

## Run

From inside `robophone/`:

```bash
./.venv/bin/python -m avatar_ui.app \
  --session-path avatar_er/state/live_session.json \
  --host 127.0.0.1 \
  --port 8088
```

Open:

```text
http://127.0.0.1:8088
```

## Backend Flow

Run the existing ER output terminal separately:

```bash
./.venv/bin/python -m avatar_er.demo_live_emotion_er \
  --camera-index 0 \
  --backend-type hf_vit \
  --model-id mo-thecreator/vit-Facial-Expression-Recognition \
  --session-path avatar_er/state/live_session.json
```

Optional typed input:

```bash
./.venv/bin/python -m avatar_er.demo_live_chat \
  --interactive-replies \
  --session-path avatar_er/state/live_session.json
```

Optional STT input:

```bash
./.venv/bin/python -m avatar_er.demo_live_stt_input \
  --stt-api-url http://localhost:8001/transcribe \
  --session-path avatar_er/state/live_session.json
```

## Endpoints

- `/`: browser UI
- `/api/session`: read-only avatar display state
- `/health`: server health

## Notes

- The UI polls `/api/session`.
- Three.js is loaded from a CDN for this prototype.
- The UI never writes to the ER session.
- If the session file is missing, the avatar stays idle.

