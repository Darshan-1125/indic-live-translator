"""Translation to Stability Engine integration adapter.

Stage 5 of the AI pipeline:
Connects Stage 4 translated events to the backend Stability Engine,
locking in stable/committed words and isolating tentative hypotheses
for real-time streaming.
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Protocol, runtime_checkable


class StabilityAdapterError(RuntimeError):
    """Raised when Stability Engine integration adapter fails."""


@runtime_checkable
class StabilityEngineProtocol(Protocol):
    """Protocol for StabilityEngine instances compatible with the adapter."""

    def process_partial(self, partial_text: str, is_final: bool = False) -> Any:
        """Process a streaming partial transcript update."""
        ...


def _extract_field(result: Any, field_name: str, default: Any = "") -> Any:
    """Extract a field from either an object attribute or a dictionary."""
    if isinstance(result, dict):
        return result.get(field_name, default)
    return getattr(result, field_name, default)


def adapt_translation_to_stability(
    event: Dict[str, Any],
    stability_engine: Any,
) -> Dict[str, Any]:
    """Convert a Stage 4 translation event into a normalized stability event.

    Args:
        event: Translation event dictionary:
            {
              "type": "translation",
              "session_id": "<session_id>",
              "speaker_id": "<speaker_id>",
              "text": "<original ASR text>",
              "translated_text": "<translated English text>",
              "is_final": bool
            }
        stability_engine: Injected StabilityEngine instance (or any object
            implementing process_partial(partial_text: str, is_final: bool)).

    Returns:
        Normalized stability event dictionary:
        {
          "type": "stable_translation",
          "session_id": "<session_id>",
          "speaker_id": "<speaker_id>",
          "translated_text": "<full current translated text>",
          "newly_committed_text": "<newly committed text>",
          "tentative_text": "<unstable text>",
          "is_final": bool,
          "stable_word_count": int,
          "tentative_word_count": int,
        }

    Raises:
        TypeError: If event is not a dictionary.
        ValueError: If event type is not 'translation' or stability_engine is missing.
        StabilityAdapterError: If stability_engine processing fails.
    """
    if not isinstance(event, dict):
        raise TypeError("event must be a dictionary representing a translation event.")

    event_type = event.get("type")
    if event_type != "translation":
        raise ValueError(
            f"Invalid event type: expected 'translation', got '{event_type}'"
        )

    if stability_engine is None:
        raise ValueError("A stability_engine instance must be provided.")

    session_id = str(event.get("session_id", ""))
    speaker_id = str(event.get("speaker_id", ""))
    is_final = bool(event.get("is_final", False))

    raw_translated_text = event.get("translated_text")
    translated_text = "" if raw_translated_text is None else str(raw_translated_text).strip()

    try:
        stability_result = stability_engine.process_partial(
            translated_text,
            is_final=is_final,
        )
    except Exception as err:
        raise StabilityAdapterError(
            f"Stability engine failed while processing translated text: {err}"
        ) from err

    full_transcript = _extract_field(stability_result, "full_transcript", "")
    newly_committed = _extract_field(stability_result, "newly_committed_text", "")
    tentative = _extract_field(stability_result, "tentative_text", "")
    stable_words = int(_extract_field(stability_result, "stable_word_count", 0))
    tentative_words = int(_extract_field(stability_result, "tentative_word_count", 0))
    res_is_final = bool(_extract_field(stability_result, "is_final", is_final))

    # Use full_transcript as the full current translated text; fallback if not set
    full_text = full_transcript if (full_transcript or not translated_text) else translated_text

    return {
        "type": "stable_translation",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "translated_text": str(full_text),
        "newly_committed_text": str(newly_committed),
        "tentative_text": str(tentative),
        "is_final": res_is_final,
        "stable_word_count": stable_words,
        "tentative_word_count": tentative_words,
    }


class TranslationStabilityAdapter:
    """Stage 5 adapter: Integrates Stage 4 translation outputs with the Stability Engine."""

    def __init__(self, stability_engine: Optional[Any] = None) -> None:
        """Initialize adapter with optional StabilityEngine instance."""
        self.stability_engine = stability_engine

    def process(
        self,
        event: Dict[str, Any],
        stability_engine: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Process a translation event and return a normalized stability event."""
        engine = stability_engine or self.stability_engine
        if engine is None:
            raise ValueError(
                "A stability_engine instance must be provided either at initialization or to process()."
            )
        return adapt_translation_to_stability(event=event, stability_engine=engine)

    def __call__(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Shorthand callable for process()."""
        return self.process(event)


# Aliases for convenience
StabilityAdapter = TranslationStabilityAdapter
stabilize_translation_event = adapt_translation_to_stability
