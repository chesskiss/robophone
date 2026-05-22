from __future__ import annotations

import argparse
import time
from datetime import datetime
from pathlib import Path

from .adapters import STTSpeechProvider
from .models import ConversationMessage
from .state import AvatarSessionStore, JsonAvatarSessionStore


DEFAULT_SESSION_PATH = Path(__file__).resolve().parent / "state" / "live_session.json"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Input-only ER terminal for STT child replies.")
    parser.add_argument("--stt-api-url", default="http://localhost:8001/transcribe")
    parser.add_argument("--language", default="en")
    parser.add_argument("--session-path", default=str(DEFAULT_SESSION_PATH))
    parser.add_argument("--reset-session", action="store_true")
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    store = _build_store(args.session_path, reset_session=args.reset_session)
    speech_provider = STTSpeechProvider(
        api_url=args.stt_api_url,
        language=args.language,
    )
    try:
        speech_provider.start()
        print("stt input mode: listening for child speech. Press Ctrl+C to stop.")
        while True:
            latest = speech_provider.get_latest()
            if latest is not None and latest.text.strip():
                _enqueue_child_input(store, text=latest.text.strip(), source="stt")
                _print_enqueue_event(latest.text.strip(), "stt")
            time.sleep(0.1)
    except KeyboardInterrupt:
        return 0
    finally:
        speech_provider.stop()


def _build_store(session_path: str | None, reset_session: bool = False) -> AvatarSessionStore:
    if not session_path:
        return AvatarSessionStore()
    session_file = Path(session_path)
    if reset_session and session_file.exists():
        session_file.unlink()
    return JsonAvatarSessionStore(session_path=session_file)


def _enqueue_child_input(store: AvatarSessionStore, text: str, source: str) -> None:
    store.enqueue_child_input(
        ConversationMessage(
            role="child",
            text=text,
            source=source,  # type: ignore[arg-type]
        )
    )


def _print_enqueue_event(text: str, source: str) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] queued child input from {source}: {text}")


if __name__ == "__main__":
    raise SystemExit(main())
