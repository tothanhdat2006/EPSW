from config import settings
from typing import Tuple


def compute_overall_confidence(
    classification_confidence: float,
    extraction_confidence: float,
) -> Tuple[float, bool]:
    """
    Compute a weighted overall confidence score.
    Returns (overall_score, requires_hitl).

    Per INSTRUCTIONS.md: Any task with AI Confidence Score < 70 must be paused
    and an event must be emitted to the `hitl-pending-topic`.
    """
    # Weighted average: classification is slightly more important
    overall = (classification_confidence * 0.55) + (extraction_confidence * 0.45)
    requires_hitl = overall < settings.confidence_threshold
    return round(overall, 2), requires_hitl
