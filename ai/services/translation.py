"""Sarvam Translation service abstraction.

Handles text translation between Indic languages and English using Sarvam Mayura models
via the official sarvamai SDK, supporting Tamil (ta-IN) and English (en-IN) bidirectional translation.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

from sarvamai import SarvamAI
from sarvamai.core.api_error import ApiError


class SarvamTranslationError(RuntimeError):
    """Raised when Sarvam Translation API request fails."""


class SarvamTranslationService:
    """Service abstraction for Sarvam Translation (Mayura) using official SarvamAI SDK.

    Attributes:
        api_key: Sarvam AI subscription key.
        client: Underlying SarvamAI SDK client instance.
        model: Translation model identifier (default: mayura:v1).
    """

    DEFAULT_MODEL = "mayura:v1"
    DEFAULT_MODE = "modern-colloquial"
    SUPPORTED_MODELS = ("mayura:v1", "sarvam-translate:v1")
    SUPPORTED_MODES = (
        "formal",
        "classic-colloquial",
        "modern-colloquial",
        "code-mixed",
    )
    SUPPORTED_LANGUAGES = (
        "ta-IN",  # Tamil
        "en-IN",  # Indian English
        "hi-IN",  # Hindi
        "kn-IN",  # Kannada
        "te-IN",  # Telugu
        "ml-IN",  # Malayalam
        "bn-IN",  # Bengali
        "gu-IN",  # Gujarati
        "mr-IN",  # Marathi
        "od-IN",  # Odia
        "pa-IN",  # Punjabi
    )

    def __init__(
        self,
        api_key: Optional[str] = None,
        client: Optional[SarvamAI] = None,
        model: str = DEFAULT_MODEL,
        timeout: float = 30.0,
    ) -> None:
        """Initialize Sarvam Translation service.

        Args:
            api_key: Optional API key. If omitted, reads SARVAM_API_KEY from environment.
            client: Optional pre-configured SarvamAI client instance (useful for dependency injection/testing).
            model: Model identifier (defaults to 'mayura:v1').
            timeout: Request timeout in seconds.

        Raises:
            ValueError: If no API key is provided and SARVAM_API_KEY environment variable is not set.
        """
        resolved_key = api_key or os.getenv("SARVAM_API_KEY")

        if client is not None:
            self.client = client
            self.api_key = resolved_key.strip() if resolved_key else None
        else:
            if not resolved_key or not resolved_key.strip():
                raise ValueError(
                    "Sarvam API key is required. Set SARVAM_API_KEY environment variable or pass api_key."
                )
            self.api_key = resolved_key.strip()
            self.client = SarvamAI(api_subscription_key=self.api_key, timeout=timeout)

        self.model = model
        self.timeout = timeout

    def translate(
        self,
        text: str,
        source_language_code: str = "ta-IN",
        target_language_code: str = "en-IN",
        mode: str = DEFAULT_MODE,
        model: Optional[str] = None,
        speaker_gender: Optional[str] = None,
        output_script: Optional[str] = None,
        numerals_format: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Translate text between supported languages using SarvamAI SDK.

        Supports translating Tamil to English, English to Tamil, and handling code-mixed text.

        Args:
            text: Text string to translate (must be non-empty, max 1,000 chars for mayura:v1).
            source_language_code: Source language code (e.g. 'ta-IN', 'en-IN', 'auto').
            target_language_code: Target language code (e.g. 'en-IN', 'ta-IN').
            mode: Translation register: 'formal', 'classic-colloquial',
                  'modern-colloquial', or 'code-mixed'. Defaults to 'modern-colloquial'.
            model: Optional model override (defaults to instance model).
            speaker_gender: Optional gender ('Male', 'Female') for grammatical agreement.
            output_script: Optional transliteration style ('roman', 'fully-native', 'spoken-form-in-native').
            numerals_format: Optional numerals format ('international', 'native').

        Returns:
            Dict containing translated result and metadata:
            - 'translated_text': Translated string
            - 'source_language_code': Detected or provided source language
            - 'request_id': Sarvam request ID

        Raises:
            ValueError: If text is empty or invalid mode is provided.
            SarvamTranslationError: If Sarvam API returns an error or request fails.
        """
        if not text or not text.strip():
            raise ValueError("Input text for translation cannot be empty.")

        if mode not in self.SUPPORTED_MODES:
            raise ValueError(
                f"Unsupported translation mode '{mode}'. Expected one of {self.SUPPORTED_MODES}"
            )

        if source_language_code == target_language_code:
            # Short-circuit if source and target languages are identical
            return {
                "translated_text": text,
                "source_language_code": source_language_code,
                "request_id": None,
            }

        kwargs: Dict[str, Any] = {
            "input": text.strip(),
            "source_language_code": source_language_code,
            "target_language_code": target_language_code,
            "mode": mode,
            "model": model or self.model,
        }
        if speaker_gender:
            kwargs["speaker_gender"] = speaker_gender
        if output_script:
            kwargs["output_script"] = output_script
        if numerals_format:
            kwargs["numerals_format"] = numerals_format

        # TODO: Add batch translation support for sentence chunk queues to reduce API roundtrips
        # TODO: Implement domain terminology glossary constraints
        # TODO: Pre-normalize colloquial Tamil code-mixed tokens before dispatching to translation

        try:
            response = self.client.text.translate(**kwargs)
        except ApiError as err:
            raise SarvamTranslationError(
                f"Sarvam Translation API error (status {err.status_code}): {err.body}"
            ) from err
        except Exception as err:
            raise SarvamTranslationError(
                f"Unexpected error while calling Sarvam Translation API: {err}"
            ) from err

        return response.model_dump()
