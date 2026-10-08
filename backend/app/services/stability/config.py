from dataclasses import dataclass


@dataclass
class StabilityConfig:
    """
    Configuration settings for the streaming ASR Stability Engine.

    Attributes:
        min_stability_count: Number of consecutive partial updates a word/token must
                             remain unchanged in order to be considered stable/committed.
                             Default is 2.
        case_sensitive: Whether token comparison during stability evaluation is case-sensitive.
                        Default is False.
        ignore_punctuation: Whether to normalize punctuation during matching comparison.
                            Default is True.
        max_uncommitted_buffer: Maximum uncommitted tokens held in memory before auto-committing
                                as a safety fallback during endless streams without pauses.
                                Default is 100.
    """
    min_stability_count: int = 2
    case_sensitive: bool = False
    ignore_punctuation: bool = True
    max_uncommitted_buffer: int = 100

    def __post_init__(self):
        if self.min_stability_count < 1:
            raise ValueError("min_stability_count must be at least 1")
        if self.max_uncommitted_buffer < 1:
            raise ValueError("max_uncommitted_buffer must be at least 1")
