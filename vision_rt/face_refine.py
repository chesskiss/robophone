"""Optional MediaPipe-based face outline refinement."""

from __future__ import annotations

from dataclasses import dataclass


FACE_OVAL_INDICES: tuple[int, ...] = (
    10,
    338,
    297,
    332,
    284,
    251,
    389,
    356,
    454,
    323,
    361,
    288,
    397,
    365,
    379,
    378,
    400,
    377,
    152,
    148,
    176,
    149,
    150,
    136,
    172,
    58,
    132,
    93,
    234,
    127,
    162,
    21,
    54,
    103,
    67,
    109,
)


@dataclass(slots=True)
class FaceOutline:
    points: list[tuple[int, int]]
    bbox_xyxy: tuple[int, int, int, int]


class FaceRefiner:
    """MediaPipe face mesh wrapper with lazy import and clean failure mode."""

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled
        self._mesh = None
        self._mp_face_mesh = None

        if not enabled:
            return

        try:
            import mediapipe as mp
        except ImportError as exc:
            raise RuntimeError(
                "MediaPipe is required when face refinement is enabled. "
                "Install `mediapipe` or disable refinement."
            ) from exc

        self._mp_face_mesh = mp.solutions.face_mesh
        self._mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def refine(self, frame_bgr) -> FaceOutline | None:
        if not self.enabled or self._mesh is None:
            return None

        import cv2

        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        result = self._mesh.process(rgb)
        if not result.multi_face_landmarks:
            return None

        frame_height, frame_width = frame_bgr.shape[:2]
        landmarks = result.multi_face_landmarks[0].landmark
        points: list[tuple[int, int]] = []
        min_x = frame_width
        min_y = frame_height
        max_x = 0
        max_y = 0

        for index in FACE_OVAL_INDICES:
            landmark = landmarks[index]
            x = min(frame_width - 1, max(0, int(landmark.x * frame_width)))
            y = min(frame_height - 1, max(0, int(landmark.y * frame_height)))
            points.append((x, y))
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

        return FaceOutline(points=points, bbox_xyxy=(min_x, min_y, max_x, max_y))

    def close(self) -> None:
        if self._mesh is not None:
            self._mesh.close()
