from typing import Optional
from .config import StabilityConfig
from .engine import StabilityEngine
from .models import StabilityResult


class StabilityAdapter:
    """
    Integration adapter for the Stability Engine.

    Provides a clean, decoupled interface for downstream services (such as ASR stream listeners)
    to feed partial transcripts into the underlying StabilityEngine without depending directly
    on engine internals.
    """

    def __init__(self, config: Optional[StabilityConfig] = None):
        """
        Initialize the adapter with an optional StabilityConfig.
        Instantiates an internal StabilityEngine instance.
        """
        self._engine = StabilityEngine(config=config)

    @property
    def engine(self) -> StabilityEngine:
        """
        Returns the underlying StabilityEngine instance.
        """
        return self._engine

    def process_asr_result(self, asr_text: str, is_final: bool = False) -> StabilityResult:
        """
        Process an incoming ASR hypothesis string and return stability results.

        Args:
            asr_text: The streaming ASR transcript hypothesis string.
            is_final: True if this hypothesis represents the final segment transcript.

        Returns:
            StabilityResult object containing newly committed text, cumulative committed text,
            tentative text, full transcript, and word counts.
        """
        return self._engine.process_partial(partial_text=asr_text, is_final=is_final)

    def reset(self) -> None:
        """
        Reset the underlying stability engine state for a new audio stream session.
        """
        self._engine.reset()
