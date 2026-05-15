from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from .models import ConversationMessage
from .state import AvatarSessionStore, JsonAvatarSessionStore


DEFAULT_SESSION_PATH = Path(__file__).resolve().parent / "state" / "live_session.json"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Input-only ER terminal for child replies.")
    parser.add_argument("--current-task", default="live RoboPhone session")
    parser.add_argument("--initial-child-message", default=None)
    parser.add_argument("--interactive-replies", action="store_true")
    parser.add_argument("--session-path", default=str(DEFAULT_SESSION_PATH))
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    store = _build_store(args.session_path)

    if args.initial_child_message:
        _enqueue_child_input(
            store,
            text=args.initial_child_message,
            source="arg_input",
        )
        _print_enqueue_event(args.initial_child_message, "arg_input")

    if not args.interactive_replies:
        return 0

    print("input mode: type child replies below. Type `quit` or `exit` to stop.")
    try:
        while True:
            reply = input("child> ").strip()
            if reply.lower() in {"quit", "exit"}:
                return 0
            if not reply:
                continue
            _enqueue_child_input(store, text=reply, source="typed_input")
            _print_enqueue_event(reply, "typed_input")
    except KeyboardInterrupt:
        return 0


def _build_store(session_path: str | None) -> AvatarSessionStore:
    if not session_path:
        return AvatarSessionStore()
    return JsonAvatarSessionStore(session_path=session_path)


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
