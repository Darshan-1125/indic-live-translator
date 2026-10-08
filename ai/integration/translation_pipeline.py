"""ASR to Translation integration pipeline for Indic Live Translator.

Stage 4 of the AI pipeline:
Takes normalized ASR events (from Stage 3 Saaras adapter) and translates
the recognized transcript into English using Sarvam Mayura Translation.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ai.services.translation import (
    SarvamTranslationError,
    SarvamTranslationService,
)


def translate_asr_event(
    event: Dict[str, Any],
    translation_service: Optional[SarvamTranslationService] = None,
    source_language_code: str = "ta-IN",
    target_language_code: str = "en-IN",
    mode: Optional[str] = None,
) -> Dict[str, Any]:
    """Translate a normalized ASR event using SarvamTranslationService.

    Preserves session_id, speaker_id, and is_final flags while populating
    the translated_text field.

    Args:
        event: Normalized ASR event dictionary:
               {
                 "type": "asr_partial",
                 "session_id": "<session_id>",
                 "speaker_id": "<speaker_id>",
                 "text": "<recognized text>",
                 "is_final": bool
               }
        translation_service: Optional SarvamTranslationService instance.
                             If None, instantiates a default service.
        source_language_code: Source language code (default: 'ta-IN').
        target_language_code: Target language code (default: 'en-IN').
        mode: Translation register mode override (e.g., 'modern-colloquial').
              Defaults to None (which uses the translation service's default mode).

    Returns:
        Translation event dictionary:
        {
          "type": "translation",
          "session_id": "<session_id>",
          "speaker_id": "<speaker_id>",
          "text": "<recognized text>",
          "translated_text": "<translated text>",
          "is_final": bool
        }

    Raises:
        TypeError: If event is not a dictionary.
        SarvamTranslationError: If the underlying translation service fails.
    """
    if not isinstance(event, dict):
        raise TypeError("event must be a dictionary representing a normalized ASR event.")

    session_id = str(event.get("session_id", ""))
    speaker_id = str(event.get("speaker_id", ""))
    raw_text = event.get("text", "")
    text_content = "" if raw_text is None else str(raw_text)
    is_final = bool(event.get("is_final", False))

    # Empty text handling: silence or empty partials should not trigger API calls
    if not text_content.strip():
        return {
            "type": "translation",
            "session_id": session_id,
            "speaker_id": speaker_id,
            "text": text_content,
            "translated_text": "",
            "is_final": is_final,
        }

    service = (
        translation_service
        if translation_service is not None
        else SarvamTranslationService()
    )

    translate_kwargs: Dict[str, Any] = {
        "text": text_content.strip(),
        "source_language_code": source_language_code,
        "target_language_code": target_language_code,
    }
    if mode is not None:
        translate_kwargs["mode"] = mode

    try:
        response = service.translate(**translate_kwargs)
    except SarvamTranslationError:
        raise
    except Exception as err:
        raise SarvamTranslationError(
            f"Translation pipeline failed during translation: {err}"
        ) from err

    # Extract translated string from dictionary or response object
    if isinstance(response, dict):
        translated_text = response.get("translated_text", "")
    elif hasattr(response, "translated_text"):
        translated_text = getattr(response, "translated_text")
    else:
        translated_text = str(response)

    return {
        "type": "translation",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "text": text_content,
        "translated_text": str(translated_text or ""),
        "is_final": is_final,
    }


class ASRTranslationPipeline:
    """Integration pipeline connecting normalized ASR events to Mayura Translation.

    Maintains default language configuration (ta-IN -> en-IN) and translates
    both Tamil and Tamil-English code-mixed transcripts.
    """

    def __init__(
        self,
        translation_service: Optional[SarvamTranslationService] = None,
        source_language_code: str = "ta-IN",
        target_language_code: str = "en-IN",
        mode: Optional[str] = None,
    ) -> None:
        """Initialize pipeline with optional translation service instance and configuration."""
        self.translation_service = (
            translation_service
            if translation_service is not None
            else SarvamTranslationService()
        )
        self.source_language_code = source_language_code
        self.target_language_code = target_language_code
        self.mode = mode

    def process(
        self,
        event: Dict[str, Any],
        source_language_code: Optional[str] = None,
        target_language_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Translate a normalized ASR event into a translation event."""
        return translate_asr_event(
            event=event,
            translation_service=self.translation_service,
            source_language_code=source_language_code or self.source_language_code,
            target_language_code=target_language_code or self.target_language_code,
            mode=self.mode,
        )

    def __call__(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Shorthand callable for process()."""
        return self.process(event)


# Alias for convenience
TranslationPipeline = ASRTranslationPipeline
