"""Sarvam Bulbul Text-to-Speech (TTS) service abstraction.

Handles text-to-speech audio synthesis supporting Tamil (ta-IN) and English (en-IN)
using Sarvam Bulbul multilingual models via the official sarvamai SDK.
"""

from __future__ import annotations

import base64
import os
from typing import Any, Dict, List, Optional

from sarvamai import SarvamAI
from sarvamai.core.api_error import ApiError


class BulbulTTSError(RuntimeError):
    """Raised when Sarvam Bulbul Text-to-Speech API request fails."""


class BulbulTTSService:
    """Service abstraction for Sarvam Bulbul Text-to-Speech using official SarvamAI SDK.

    Attributes:
        api_key: Sarvam AI subscription key.
        client: Underlying SarvamAI SDK client instance.
        model: Bulbul model version (default: bulbul:v3).
        default_speaker: Default voice profile identifier.
    """

    DEFAULT_MODEL = "bulbul:v3"
    DEFAULT_SPEAKER = "ratan"
    SUPPORTED_MODELS = ("bulbul:v3", "bulbul:v4-flash", "bulbul:v2")
    SUPPORTED_CODECS = ("wav", "mp3", "aac", "flac", "linear16")
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
        default_speaker: str = DEFAULT_SPEAKER,
        timeout: float = 30.0,
    ) -> None:
        """Initialize Bulbul Text-to-Speech service.

        Args:
            api_key: Optional API key. If omitted, reads SARVAM_API_KEY from environment.
            client: Optional pre-configured SarvamAI client instance (useful for dependency injection/testing).
            model: Model identifier (defaults to 'bulbul:v3').
            default_speaker: Default voice profile identifier (defaults to 'ratan').
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
        self.default_speaker = default_speaker
        self.timeout = timeout

    def synthesize(
        self,
        text: str,
        language_code: str = "ta-IN",
        speaker: Optional[str] = None,
        pace: float = 1.0,
        output_audio_codec: str = "wav",
        speech_sample_rate: Optional[int] = None,
        temperature: Optional[float] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Synthesize input text into spoken audio using Sarvam Bulbul via SarvamAI SDK.

        Supports Tamil ('ta-IN') and English ('en-IN') voices with configurable pace and speaker.

        Args:
            text: Text string to synthesize (max 2,500 characters).
            language_code: BCP-47 language tag (e.g. 'ta-IN', 'en-IN').
            speaker: Voice profile identifier (defaults to default_speaker).
            pace: Speech speed multiplier between 0.5 and 2.0. Defaults to 1.0.
            output_audio_codec: Audio output format ('wav', 'mp3', 'aac', 'flac', 'linear16').
            speech_sample_rate: Output sample rate (e.g. 16000, 24000, 48000 Hz).
            temperature: Randomness/expressiveness (0.01 to 1.0).
            model: Model override (defaults to instance model, 'bulbul:v3').

        Returns:
            Dict containing synthesized audio and metadata structured for backend/LiveKit consumption:
            - 'audio_bytes': Decoded raw bytes of synthesized audio (ready for playback/streaming)
            - 'audios_base64': Raw base64-encoded audio strings from API
            - 'codec': Audio codec used ('wav', 'mp3', etc.)
            - 'sample_rate': Sampling rate of audio (defaults to 24000 or requested rate)
            - 'language_code': Language code of synthesized audio
            - 'speaker': Active speaker persona
            - 'request_id': Sarvam request ID

        Raises:
            ValueError: If text is empty, exceeds limits, or parameters are out of range.
            BulbulTTSError: If Sarvam API returns an error or audio decoding fails.
        """
        if not text or not text.strip():
            raise ValueError("Input text for speech synthesis cannot be empty.")

        if len(text) > 2500:
            raise ValueError("Input text exceeds maximum length of 2,500 characters for Bulbul TTS.")

        if output_audio_codec not in self.SUPPORTED_CODECS:
            raise ValueError(
                f"Unsupported output_audio_codec '{output_audio_codec}'. Expected one of {self.SUPPORTED_CODECS}"
            )

        if not (0.5 <= pace <= 2.0):
            raise ValueError(f"Pace must be between 0.5 and 2.0 for Bulbul. Received {pace}")

        selected_speaker = speaker or self.default_speaker
        target_model = model or self.model

        kwargs: Dict[str, Any] = {
            "text": text.strip(),
            "language_code": language_code,
            "speaker": selected_speaker,
            "pace": pace,
            "output_audio_codec": output_audio_codec,
            "model": target_model,
        }
        if speech_sample_rate is not None:
            kwargs["speech_sample_rate"] = speech_sample_rate
        if temperature is not None:
            kwargs["temperature"] = temperature

        # TODO: Add streaming audio synthesis via client.text_to_speech_streaming or convert_stream for low-latency chunks
        # TODO: Implement audio resampling and Opus transcoding for direct LiveKit WebRTC track publishing (e.g. 48kHz mono/stereo)
        # TODO: Evaluate regional speaker voice selections optimized for Tamil vs Indian English accents

        try:
            response = self.client.text_to_speech.convert(**kwargs)
        except ApiError as err:
            raise BulbulTTSError(
                f"Sarvam Bulbul TTS API error (status {err.status_code}): {err.body}"
            ) from err
        except Exception as err:
            raise BulbulTTSError(
                f"Unexpected error while calling Sarvam Bulbul TTS API: {err}"
            ) from err

        audios: List[str] = getattr(response, "audios", []) or []
        if not audios:
            raise BulbulTTSError("Sarvam Bulbul TTS response contained no audio segments.")

        try:
            primary_audio_bytes = base64.b64decode(audios[0])
        except Exception as err:
            raise BulbulTTSError(f"Failed to decode base64 audio payload: {err}") from err

        return {
            "audio_bytes": primary_audio_bytes,
            "audios_base64": audios,
            "codec": output_audio_codec,
            "sample_rate": speech_sample_rate or 24000,
            "language_code": language_code,
            "speaker": selected_speaker,
            "request_id": getattr(response, "request_id", None),
        }
