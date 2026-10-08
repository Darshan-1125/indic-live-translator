"""
Stability Engine Service Package

Provides real-time stability evaluation for streaming ASR (Automatic Speech Recognition)
partial transcripts. Differentiates between committed (stable) text and tentative text.
"""

from .config import StabilityConfig
from .models import StabilityResult
from .engine import StabilityEngine
from .adapter import StabilityAdapter

__all__ = ["StabilityEngine", "StabilityConfig", "StabilityResult", "StabilityAdapter"]
