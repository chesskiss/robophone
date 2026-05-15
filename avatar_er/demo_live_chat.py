from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path

from .adapters import (
    GeminiConversationResponseProvider,
    GeminiConversationRouteProvider,
    GeminiEmotionResponseProvider,
    GroundEvalManualQaProvider,
)
from .decision import AvatarDecisionEngine
from .state import AvatarSessionStore, JsonAvatarSessionStore


DEFAULT_SESSION_PATH = Path(__file__).resolve().parent / "state" / "live_session.json"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Chat-only ER debug loop without camera input.")
    parser.add_argument("--current-task", default="live RoboPhone session")
    parser.add_argument("--initial-child-message", default=None)
    parser.add_argument("--interactive-replies", action="store_true")
    parser.add_argument("--session-path", default=str(DEFAULT_SESSION_PATH))
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    store = _build_store(args.session_path)
    engine = AvatarDecisionEngine(
        store=store,
        manual_qa_provider=GroundEvalManualQaProvider(),
        emotion_response_provider=GeminiEmotionResponseProvider(),
        conversation_route_provider=GeminiConversationRouteProvider(),
        conversation_response_provider=GeminiConversationResponseProvider(),
    )

    if args.initial_child_message:
        _print_terminal_event(
            engine.process(
                {
                    "speech_text": args.initial_child_message,
                    "input_source": "arg_input",
                    "current_task": args.current_task,
                }
            )
        )

    if not args.interactive_replies:
        return 0

    print("interactive chat mode: type child replies below. Type `quit` or `exit` to stop.")
    try:
        while True:
            reply = input("child> ").strip()
            if reply.lower() in {"quit", "exit"}:
                return 0
            if not reply:
                continue
            _print_terminal_event(
                engine.process(
                    {
                        "speech_text": reply,
                        "input_source": "typed_input",
                        "current_task": args.current_task,
                    }
                )
            )
    except KeyboardInterrupt:
        return 0


def _build_store(session_path: str | None) -> AvatarSessionStore:
    if not session_path:
        return AvatarSessionStore()
    return JsonAvatarSessionStore(session_path=session_path)


def _print_terminal_event(result: dict) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    payload = result.get("payload", {})
    route = payload.get("route")
    backend = payload.get("used_backend")
    backend_error = payload.get("backend_error")
    print(f"[{timestamp}] action={result.get('action_type')}")
    if route:
        print(f"route={route} backend={backend}")
    if backend_error:
        print(f"backend_error={backend_error}")
    if result.get("should_speak") and result.get("response_text"):
        print(f"teacher: {result['response_text']}")
    else:
        print(f"teacher: ... ({result.get('reason')})")


if __name__ == "__main__":
    raise SystemExit(main())
