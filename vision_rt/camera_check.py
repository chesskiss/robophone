"""Quick webcam connectivity check for Camo or any standard webcam."""

from __future__ import annotations

import argparse


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="List and preview webcam devices.")
    parser.add_argument("--max-index", type=int, default=10)
    parser.add_argument("--preview-index", type=int, default=None)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    return parser


def list_cameras(max_index: int) -> list[int]:
    import cv2

    found: list[int] = []
    for index in range(max_index + 1):
        capture = cv2.VideoCapture(index)
        ok, _ = capture.read()
        if capture.isOpened() and ok:
            found.append(index)
        capture.release()
    return found


def preview_camera(index: int, width: int, height: int) -> int:
    import cv2

    capture = cv2.VideoCapture(index)
    if not capture.isOpened():
        print(f"Could not open camera index {index}.")
        return 1

    capture.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    capture.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                print("Camera opened but no frames were received.")
                return 1

            cv2.putText(
                frame,
                f"camera index: {index}",
                (16, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.imshow("vision_rt camera check", frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
        return 0
    finally:
        capture.release()
        cv2.destroyAllWindows()


def main() -> int:
    args = build_arg_parser().parse_args()
    found = list_cameras(args.max_index)
    if found:
        print("Available camera indices:", ", ".join(str(index) for index in found))
    else:
        print("No working camera indices found.")

    if args.preview_index is not None:
        return preview_camera(args.preview_index, args.width, args.height)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
