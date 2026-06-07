from __future__ import annotations

import argparse
import json
import mimetypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .state_reader import read_avatar_display_state


DEFAULT_SESSION_PATH = Path(__file__).resolve().parent.parent / "avatar_er" / "state" / "live_session.json"
STATIC_DIR = Path(__file__).resolve().parent / "static"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Display-only 3D avatar UI for RoboPhone ER sessions.")
    parser.add_argument("--session-path", default=str(DEFAULT_SESSION_PATH))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8088)
    return parser


def main() -> int:
    args = build_arg_parser().parse_args()
    handler = partial(AvatarUiRequestHandler, session_path=Path(args.session_path))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"avatar_ui serving http://{args.host}:{args.port}")
    print(f"avatar_ui reading session {Path(args.session_path)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


class AvatarUiRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, session_path: Path, **kwargs) -> None:
        self.session_path = session_path
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json({"status": "ok"})
            return
        if parsed.path == "/api/session":
            self._send_json(read_avatar_display_state(self.session_path))
            return
        if parsed.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def guess_type(self, path: str) -> str:
        if path.endswith(".js"):
            return "text/javascript"
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def _send_json(self, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    raise SystemExit(main())

