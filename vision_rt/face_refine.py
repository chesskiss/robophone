"""OpenCV face detection and optional MediaPipe face outline refinement."""

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


@dataclass(slots=True)
class FaceDetectionBox:
    bbox_xyxy: tuple[int, int, int, int]
    confidence: float


class FaceRefiner:
    """OpenCV face detector plus optional MediaPipe face mesh wrapper."""

    def __init__(self, enabled: bool, prefer_face_box: bool = True) -> None:
        self.enabled = enabled
        self.prefer_face_box = prefer_face_box
        self._face_detector = None
        self._mesh = None
        self._mp_face_mesh = None

        try:
            import cv2
        except ImportError as exc:
            raise RuntimeError(
                "OpenCV is required for face detection. Install `opencv-python`."
            ) from exc

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self._face_detector = cv2.CascadeClassifier(cascade_path)
        if self._face_detector.empty():
            raise RuntimeError(
                "OpenCV Haar cascade for face detection could not be loaded."
            )

        if not enabled:
            return

        try:
            import mediapipe as mp
        except ImportError:
            self._mesh = None
            self._mp_face_mesh = None
            return

        try:
            self._mp_face_mesh = mp.solutions.face_mesh
        except AttributeError:
            try:
                from mediapipe.python.solutions import face_mesh
            except ImportError:
                self._mesh = None
                self._mp_face_mesh = None
                return
            self._mp_face_mesh = face_mesh

        self._mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def detect_face(self, frame_bgr) -> FaceDetectionBox | None:
        if self._face_detector is None:
            return None

        import cv2

        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        detections = self._face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(40, 40),
        )
        if len(detections) == 0:
            return None

        x, y, width, height = max(detections, key=lambda item: item[2] * item[3])
        x1 = int(x)
        y1 = int(y)
        x2 = int(x + width)
        y2 = int(y + height)
        return FaceDetectionBox(
            bbox_xyxy=(x1, y1, x2, y2),
            confidence=1.0,
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
