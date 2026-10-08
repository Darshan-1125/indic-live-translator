from dataclasses import dataclass
from typing import Dict, Any


@dataclass
class StabilityResult:
    """
    Represents the output state from processing a single partial ASR transcript update.

    Attributes:
        newly_committed_text: Text committed *for the first time* in this update (delta emission).
        cumulative_committed_text: Full cumulative stable text committed across the stream so far.
        tentative_text: The remaining uncommitted, unstable hypothesis from the latest partial.
        full_transcript: Full transcript combining cumulative committed text and tentative text.
        is_final: Indicates whether this is the final hypothesis of the audio stream/segment.
        stable_word_count: Total count of committed words so far.
        tentative_word_count: Count of tentative words in the current update.
    """
    newly_committed_text: str
    cumulative_committed_text: str
    tentative_text: str
    full_transcript: str
    is_final: bool = False
    stable_word_count: int = 0
    tentative_word_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize result to a standard dictionary for API / WebSocket transmission.
        """
        return {
            "newly_committed_text": self.newly_committed_text,
            "cumulative_committed_text": self.cumulative_committed_text,
            "tentative_text": self.tentative_text,
            "full_transcript": self.full_transcript,
            "is_final": self.is_final,
            "stable_word_count": self.stable_word_count,
            "tentative_word_count": self.tentative_word_count,
        }
