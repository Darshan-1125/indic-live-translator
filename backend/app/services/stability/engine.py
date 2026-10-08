import string
from typing import List, Optional
from .config import StabilityConfig
from .models import StabilityResult


class StabilityEngine:
    """
    Real-time Stability Engine for streaming ASR partial transcripts.

    Receives streaming partial hypotheses, compares consecutive updates, and locks in text that
    remains stable across a configurable threshold of consecutive updates. Distinguishes between
    tentative text and committed/stable text, preventing duplicate emissions of committed text.
    """

    def __init__(self, config: Optional[StabilityConfig] = None):
        self.config = config or StabilityConfig()
        self.reset()

    def reset(self) -> None:
        """
        Reset internal state for a new speech session or stream boundary.
        """
        self._committed_tokens: List[str] = []
        self._prev_uncommitted_tokens: List[str] = []
        self._prev_match_counts: List[int] = []

    @property
    def committed_text(self) -> str:
        """
        Returns the current cumulative committed text as a single string.
        """
        return " ".join(self._committed_tokens)

    def _normalize_token(self, token: str) -> str:
        """
        Normalizes a token string according to engine configuration for matching comparison.
        """
        norm = token
        if not self.config.case_sensitive:
            norm = norm.lower()
        if self.config.ignore_punctuation:
            norm = norm.strip(string.punctuation)
        return norm

    def _tokens_match(self, token_a: str, token_b: str) -> bool:
        """
        Checks if two tokens match based on normalization rules.
        """
        return self._normalize_token(token_a) == self._normalize_token(token_b)

    def _tokenize(self, text: str) -> List[str]:
        """
        Splits text into whitespace-separated tokens.
        """
        if not text:
            return []
        return [t for t in text.strip().split() if t]

    def _strip_committed_prefix(self, tokens: List[str]) -> List[str]:
        """
        Strips already committed tokens from the beginning of an incoming partial transcript token list.
        """
        if not self._committed_tokens or not tokens:
            return tokens

        match_idx = 0
        max_overlap = min(len(self._committed_tokens), len(tokens))

        for i in range(max_overlap):
            if self._tokens_match(self._committed_tokens[i], tokens[i]):
                match_idx = i + 1
            else:
                break

        return tokens[match_idx:]

    def process_partial(self, partial_text: str, is_final: bool = False) -> StabilityResult:
        """
        Process a streaming partial transcript update.

        Args:
            partial_text: The raw partial (or final) transcript string received from ASR.
            is_final: Flag indicating if this is the final hypothesis chunk for the stream/utterance.

        Returns:
            StabilityResult object containing newly committed text, cumulative committed text,
            tentative text, full transcript, and word counts.
        """
        raw_tokens = self._tokenize(partial_text)
        candidate_uncommitted = self._strip_committed_prefix(raw_tokens)

        newly_committed_tokens: List[str] = []

        if is_final:
            # Final chunk: all remaining uncommitted tokens are immediately committed
            newly_committed_tokens = candidate_uncommitted
            self._committed_tokens.extend(newly_committed_tokens)
            self._prev_uncommitted_tokens = []
            self._prev_match_counts = []
            tentative_tokens: List[str] = []
        else:
            # Partial chunk: compare against previous uncommitted tokens
            new_counts: List[int] = []
            matching_prefix_len = 0

            max_check = min(len(candidate_uncommitted), len(self._prev_uncommitted_tokens))
            for i in range(max_check):
                if self._tokens_match(candidate_uncommitted[i], self._prev_uncommitted_tokens[i]):
                    new_counts.append(self._prev_match_counts[i] + 1)
                    matching_prefix_len = i + 1
                else:
                    break

            # Initialize streak count = 1 for any new candidate tokens beyond the matching prefix
            for i in range(matching_prefix_len, len(candidate_uncommitted)):
                new_counts.append(1)

            # Determine how many consecutive tokens from the start meet the min_stability_count
            stable_prefix_len = 0
            for count in new_counts:
                if count >= self.config.min_stability_count:
                    stable_prefix_len += 1
                else:
                    break

            # Buffer limit fallback: if buffer exceeds threshold, force-commit at least 1 token
            if stable_prefix_len == 0 and len(candidate_uncommitted) > self.config.max_uncommitted_buffer:
                stable_prefix_len = 1

            if stable_prefix_len > 0:
                newly_committed_tokens = candidate_uncommitted[:stable_prefix_len]
                self._committed_tokens.extend(newly_committed_tokens)
                
                tentative_tokens = candidate_uncommitted[stable_prefix_len:]
                self._prev_match_counts = new_counts[stable_prefix_len:]
                self._prev_uncommitted_tokens = tentative_tokens
            else:
                newly_committed_tokens = []
                tentative_tokens = candidate_uncommitted
                self._prev_match_counts = new_counts
                self._prev_uncommitted_tokens = tentative_tokens

        cumulative_committed_str = " ".join(self._committed_tokens)
        newly_committed_str = " ".join(newly_committed_tokens)
        tentative_str = " ".join(tentative_tokens)

        if cumulative_committed_str and tentative_str:
            full_str = f"{cumulative_committed_str} {tentative_str}"
        elif cumulative_committed_str:
            full_str = cumulative_committed_str
        else:
            full_str = tentative_str

        return StabilityResult(
            newly_committed_text=newly_committed_str,
            cumulative_committed_text=cumulative_committed_str,
            tentative_text=tentative_str,
            full_transcript=full_str,
            is_final=is_final,
            stable_word_count=len(self._committed_tokens),
            tentative_word_count=len(tentative_tokens),
        )
