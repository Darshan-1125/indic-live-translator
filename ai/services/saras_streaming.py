"""Saaras v4 real-time streaming ASR adapter.

Stage 2 (streaming) of the AI pipeline:
Wraps the Sarvam SDK's AsyncSpeechToTextStreamingClient WebSocket connection
and normalizes every incoming transcript into the backend ASR event contract:

{
  "type": "asr_partial",
  "session_id": "<session_id>",
  "speaker_id": "<speaker_id>",
  "text": "<recognized text>",
  "is_final": false,
  "language_code": "<BCP-47 or None>",
  "is_code_mixed": true/false
}

Design notes:
- Uses the official sarvamai AsyncSarvamAI SDK's WebSocket streaming client.
- Each "data" response from the server is treated as a partial transcript until
  the caller signals the final chunk (is_final=True), after which flush() is
  sent and the last transcript event is emitted as is_final=True.
- "events" (VAD signals) and "error" frames are handled without crashing.
- No translation, no TTS, no FastAPI/WebSocket/LiveKit coupling.
- Language / code-mix metadata is taken from the server response if present;
  never fabricated.
"""

from __future__ import annotations

import base64
import os
from typing import Any, AsyncIterator, Dict, Optional

from sarvamai import AsyncSarvamAI
from sarvamai.core.api_error import ApiError


class SaarasStreamingError(RuntimeError):
    """Raised when the Saaras real-time streaming session encounters a fatal error."""


# Mode value when code-mixed output is requested
_CODEMIX_MODE = "codemix"
# Default model for streaming – saaras:v4 supports codemix mode
_DEFAULT_MODEL = "saaras:v4"
# Default language code for Tamil-English streaming
_DEFAULT_LANGUAGE_CODE = "ta-IN"
# Default mode – codemix captures Tanglish naturally
_DEFAULT_MODE = _CODEMIX_MODE


def _normalize_streaming_event(
    transcript: str,
    session_id: str,
    speaker_id: str,
    is_final: bool,
    language_code: Optional[str],
    mode: str,
) -> Dict[str, Any]:
    """Build a normalized ASR event dict from a streaming transcript chunk."""
    # is_code_mixed: True when mode is "codemix" or the text already mixes scripts.
    # We set it to True when using codemix mode so that the backend knows how to
    # hand off to translation. When using pure "transcribe" mode, set to False.
    is_code_mixed = mode == _CODEMIX_MODE

    event: Dict[str, Any] = {
        "type": "asr_partial",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "text": transcript,
        "is_final": is_final,
    }

    # Optional fields: only included when server provides them
    if language_code is not None:
        event["language_code"] = language_code
    event["is_code_mixed"] = is_code_mixed

    return event


class SaarasStreamingASR:
    """Real-time streaming ASR using Sarvam Saaras v4 via the official AsyncSarvamAI SDK.

    Usage (async generator interface):

        streamer = SaarasStreamingASR(api_key="...", session_id="s1", speaker_id="u1")

        audio_chunks = [chunk1, chunk2, ..., last_chunk]
        async for event in streamer.stream(audio_chunks, is_final_chunk=True):
            # event: normalized ASR event dict
            print(event)

    The caller provides raw PCM / WAV audio bytes chunks. Each chunk is base64-
    encoded and sent to the Sarvam WebSocket. Transcripts arrive asynchronously.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        async_client: Optional[AsyncSarvamAI] = None,
        session_id: str = "",
        speaker_id: str = "",
        language_code: str = _DEFAULT_LANGUAGE_CODE,
        model: str = _DEFAULT_MODEL,
        mode: str = _DEFAULT_MODE,
        sample_rate: int = 16000,
        input_audio_codec: str = "wav",
    ) -> None:
        """Initialize the streaming ASR adapter.

        Args:
            api_key: Sarvam subscription key. Falls back to SARVAM_API_KEY env var.
            async_client: Optional pre-built AsyncSarvamAI instance (for testing).
            session_id: Session identifier forwarded to every normalized event.
            speaker_id: Speaker identifier forwarded to every normalized event.
            language_code: BCP-47 code passed to Saaras (default: 'ta-IN').
            model: Saaras model to use (default: 'saaras:v4').
            mode: Transcription mode; 'codemix' handles Tanglish (default).
            sample_rate: Audio sample rate in Hz (default: 16000).
            input_audio_codec: Audio format sent over the WebSocket (default: 'wav').

        Raises:
            ValueError: If no API key is available and async_client is not injected.
        """
        if async_client is not None:
            self._client = async_client
        else:
            resolved_key = api_key or os.getenv("SARVAM_API_KEY")
            if not resolved_key or not resolved_key.strip():
                raise ValueError(
                    "Sarvam API key is required. Set SARVAM_API_KEY env var or pass api_key."
                )
            self._client = AsyncSarvamAI(api_subscription_key=resolved_key.strip())

        self.session_id = session_id
        self.speaker_id = speaker_id
        self.language_code = language_code
        self.model = model
        self.mode = mode
        self.sample_rate = sample_rate
        self.input_audio_codec = input_audio_codec

    async def stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        is_final_chunk: bool = False,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Stream audio chunks to Saaras v4 and yield normalized ASR events.

        Opens one WebSocket connection per call. Audio chunks are base64-encoded
        WAV/PCM frames sent in order. After the last chunk, if is_final_chunk=True,
        a flush() is sent to force finalization of any buffered audio.

        Every "data" transcript received from the server is emitted as an
        `asr_partial` event. The very last transcript, if is_final_chunk is True,
        is emitted as `is_final=True`.

        Args:
            audio_chunks: Async iterable of raw audio byte chunks (WAV/PCM).
            is_final_chunk: If True, sends a flush() after all chunks and marks
                            the last transcript event as final.

        Yields:
            Normalized ASR event dictionaries.

        Raises:
            SaarasStreamingError: On connection failure or API error.
        """
        last_event: Optional[Dict[str, Any]] = None

        try:
            async with self._client.speech_to_text_streaming.connect(
                language_code=self.language_code,
                model=self.model,
                mode=self.mode,
                input_audio_codec=self.input_audio_codec,
                sample_rate=str(self.sample_rate),
            ) as socket:

                # --- Send all audio chunks ---
                async for raw_bytes in audio_chunks:
                    if not raw_bytes:
                        continue
                    b64_audio = base64.b64encode(raw_bytes).decode("utf-8")
                    await socket.transcribe(
                        audio=b64_audio,
                        encoding=f"audio/{self.input_audio_codec}",
                        sample_rate=self.sample_rate,
                    )

                # --- Flush if this is the last call ---
                if is_final_chunk:
                    await socket.flush()

                # --- Receive and normalize all responses ---
                async for response in socket:
                    event = self._handle_response(response)
                    if event is not None:
                        last_event = event
                        yield event

        except ApiError as err:
            raise SaarasStreamingError(
                f"Saaras streaming API error (status {err.status_code}): {err.body}"
            ) from err
        except SaarasStreamingError:
            raise
        except Exception as err:
            raise SaarasStreamingError(
                f"Unexpected error in Saaras streaming session: {err}"
            ) from err

        # --- Emit final event if needed ---
        if is_final_chunk and last_event is not None and not last_event.get("is_final"):
            final_event = dict(last_event)
            final_event["is_final"] = True
            yield final_event

    def _handle_response(
        self, response: Any
    ) -> Optional[Dict[str, Any]]:
        """Parse a single WebSocket response into a normalized ASR event or None.

        Uses duck typing (hasattr) so the method works with real SDK objects and
        lightweight fake objects in tests alike.

        - "data" responses with a transcript field → normalized asr_partial event
        - "data" responses with an error field → raises SaarasStreamingError
        - "events" (VAD signals) → silently skipped
        - Anything else → silently skipped

        Returns:
            Normalized event dict, or None if the response should be skipped.
        """
        if response is None:
            return None

        resp_type = getattr(response, "type", None)
        data = getattr(response, "data", None)

        if resp_type == "error":
            # Duck-typed ErrorData check: has .error and .code attributes
            if hasattr(data, "error") and hasattr(data, "code"):
                raise SaarasStreamingError(
                    f"Saaras streaming server error [{data.code}]: {data.error}"
                )
            raise SaarasStreamingError(f"Saaras streaming server returned error: {data!r}")

        if resp_type == "events":
            # VAD signal – not a transcript, skip silently
            return None

        if resp_type == "data":
            # Duck-typed SpeechToTextTranscriptionData check: has .transcript attribute
            if hasattr(data, "transcript"):
                transcript = data.transcript or ""
                language_code = getattr(data, "language_code", None)
                return _normalize_streaming_event(
                    transcript=transcript,
                    session_id=self.session_id,
                    speaker_id=self.speaker_id,
                    is_final=False,          # marked final externally after flush
                    language_code=language_code,
                    mode=self.mode,
                )

        # Unknown response shape – skip
        return None

