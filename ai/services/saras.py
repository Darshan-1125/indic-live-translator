"""Sarvam Saaras Speech-to-Text (STT) service abstraction.

Handles speech transcription supporting Tamil (ta-IN), English (en-IN),
and Tamil-English code-mixed speech using Sarvam Saaras models via the official sarvamai SDK.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, BinaryIO, Dict, List, Optional, Union

from sarvamai import SarvamAI
from sarvamai.core.api_error import ApiError


class SaarasSTTError(RuntimeError):
    """Raised when Sarvam Saaras Speech-to-Text API request fails."""


class SaarasSpeechToTextService:
    """Service abstraction for Sarvam Saaras Speech-to-Text using official SarvamAI SDK.

    Attributes:
        api_key: Sarvam AI subscription key.
        client: Underlying SarvamAI SDK client instance.
        model: Saaras model version (default: saaras:v4).
    """

    DEFAULT_MODEL = "saaras:v4"
    SUPPORTED_MODELS = ("saaras:v4", "saaras:v3")
    SUPPORTED_OUTPUT_MODES = ("transcribe", "translate", "verbatim", "translit", "codemix")
    SUPPORTED_LANGUAGES = (
        "ta-IN",  # Tamil
        "en-IN",  # English
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
        """Initialize Saaras Speech-to-Text service.

        Args:
            api_key: Optional API key. If omitted, reads SARVAM_API_KEY from environment.
            client: Optional pre-configured SarvamAI client instance (useful for dependency injection/testing).
            model: Model identifier (defaults to 'saaras:v4').
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

    def transcribe(
        self,
        audio: Union[str, Path, bytes, BinaryIO],
        language_code: Optional[str] = "ta-IN",
        output_mode: str = "transcribe",
        model: Optional[str] = None,
        with_timestamps: bool = False,
        keyterms: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Transcribe speech audio into text using Sarvam Saaras via SarvamAI SDK.

        Supports Tamil ('ta-IN'), English ('en-IN'), and code-mixed speech
        via output_mode='codemix' or auto-detection.

        Args:
            audio: Path to audio file, raw audio bytes, or binary stream.
            language_code: BCP-47 language tag (e.g. 'ta-IN', 'en-IN').
                           If None, Sarvam attempts auto-detection.
            output_mode: Output mode: 'transcribe', 'translate', 'verbatim',
                         'translit', or 'codemix'. Defaults to 'transcribe'.
            model: Specific model override (defaults to instance model, 'saaras:v4').
            with_timestamps: Whether to return chunk-level timestamps.
            keyterms: Optional list of domain-specific terms (supported in saaras:v4).

        Returns:
            Dict containing transcript and metadata:
            - 'transcript': Recognized text
            - 'language_code': Detected or provided language tag
            - 'request_id': Sarvam request ID
            - 'timestamps': Optional chunk timestamps if requested

        Raises:
            ValueError: If invalid output_mode is specified.
            FileNotFoundError: If audio file path does not exist.
            SaarasSTTError: If Sarvam API returns an error or request fails.
        """
        if output_mode not in self.SUPPORTED_OUTPUT_MODES:
            raise ValueError(
                f"Unsupported output_mode '{output_mode}'. Expected one of {self.SUPPORTED_OUTPUT_MODES}"
            )

        if isinstance(audio, (str, Path)):
            audio_path = Path(audio)
            if not audio_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            with open(audio_path, "rb") as f_handle:
                return self._invoke_sdk_transcribe(
                    file=f_handle,
                    model=model,
                    output_mode=output_mode,
                    language_code=language_code,
                    with_timestamps=with_timestamps,
                    keyterms=keyterms,
                )

        if isinstance(audio, bytes):
            return self._invoke_sdk_transcribe(
                file=("audio.wav", audio, "audio/wav"),
                model=model,
                output_mode=output_mode,
                language_code=language_code,
                with_timestamps=with_timestamps,
                keyterms=keyterms,
            )

        # File-like / BinaryIO object
        return self._invoke_sdk_transcribe(
            file=audio,
            model=model,
            output_mode=output_mode,
            language_code=language_code,
            with_timestamps=with_timestamps,
            keyterms=keyterms,
        )

    def _invoke_sdk_transcribe(
        self,
        file: Any,
        model: Optional[str],
        output_mode: str,
        language_code: Optional[str],
        with_timestamps: bool,
        keyterms: Optional[List[str]],
    ) -> Dict[str, Any]:
        """Invoke SarvamAI SDK transcribe method with parameter mapping and error handling."""
        target_model = model or self.model

        kwargs: Dict[str, Any] = {
            "file": file,
            "model": target_model,
            "mode": output_mode,
            "with_timestamps": with_timestamps,
        }
        if language_code:
            kwargs["language_code"] = language_code
        if keyterms:
            kwargs["keyterms"] = keyterms

        # TODO: Add WebSocket streaming transcription via client.speech_to_text_streaming or speech_to_text_realtime_streaming
        # TODO: Implement VAD (Voice Activity Detection) frame preprocessing before dispatching audio chunks
        # TODO: Add retry mechanism with exponential backoff for network transient failures

        try:
            response = self.client.speech_to_text.transcribe(**kwargs)
        except ApiError as err:
            raise SaarasSTTError(
                f"Sarvam Saaras STT API error (status {err.status_code}): {err.body}"
            ) from err
        except Exception as err:
            raise SaarasSTTError(
                f"Unexpected error while calling Sarvam Saaras STT API: {err}"
            ) from err

        return response.model_dump()
