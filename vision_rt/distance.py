"""Distance estimation heuristics based on detection geometry."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class DistanceEstimate:
    label: str
    approx_distance_m: float | None
    normalized_scale: float


def estimate_distance_from_box(
    box_xyxy: tuple[float, float, float, float],
    frame_size: tuple[int, int],
) -> DistanceEstimate:
    """
    Estimate distance from bounding-box size.

    This is a heuristic only. It assumes that larger boxes correspond to a
    closer subject and returns both a coarse distance bucket and a simple
    approximate meter estimate for quick evaluation work.
    """

    frame_width, frame_height = frame_size
    x1, y1, x2, y2 = box_xyxy
    box_width = max(1.0, x2 - x1)
    box_height = max(1.0, y2 - y1)
    box_area = box_width * box_height
    frame_area = max(1.0, float(frame_width * frame_height))
    normalized_scale = min(1.0, box_area / frame_area)

    if normalized_scale >= 0.20:
        label = "very close"
        approx_distance_m = 0.4
    elif normalized_scale >= 0.10:
        label = "close"
        approx_distance_m = 0.8
    elif normalized_scale >= 0.04:
        label = "mid"
        approx_distance_m = 1.5
    elif normalized_scale >= 0.015:
        label = "far"
        approx_distance_m = 2.5
    else:
        label = "very far"
        approx_distance_m = 4.0

    return DistanceEstimate(
        label=label,
        approx_distance_m=approx_distance_m,
        normalized_scale=normalized_scale,
    )
