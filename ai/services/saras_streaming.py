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
- Concurrently streams audio chunks and receives transcripts asynchronously without blocking.
- Supports Saaras VAD events:
    - signal_type="START_SPEECH": speech has started.
    - signal_type="END_SPEECH": speech has ended for this turn.
- Intermediate transcripts emitted while audio is being streamed are marked is_final=False.
- When is_final_chunk=True, socket.flush() is sent, and the finalized transcript is marked is_final=True.
- In continuous streaming mode (is_final_chunk=False), transcripts following END_SPEECH are marked is_final=True.
- Only legitimately available metadata from the server response is included (no fabricated code-mix flags).
- Cleans up tasks and closes WebSockets reliably on completion or cancellation.
"""

from __future__ import annotations

import asyncio
import base64
import os
from typing import Any, AsyncIterator, Dict, Optional, Union

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

# Timeout in seconds to drain any final server messages after flush() has been sent
_POST_FLUSH_DRAIN_TIMEOUT = 1.0

_SENTINEL = object()


def _normalize_streaming_event(
    transcript: str,
    session_id: str,
    speaker_id: str,
    is_final: bool,
    language_code: Optional[str] = None,
    is_code_mixed: Optional[bool] = None,
    mode: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a normalized ASR event dict from a streaming transcript chunk.

    Mandatory fields: type, session_id, speaker_id, text, is_final.
    Optional fields: language_code, is_code_mixed (only included when legitimately available).
    """
    event: Dict[str, Any] = {
        "type": "asr_partial",
        "session_id": session_id,
        "speaker_id": speaker_id,
        "text": transcript,
        "is_final": is_final,
    }

    if language_code is not None:
        event["language_code"] = language_code

    if is_code_mixed is not None:
        event["is_code_mixed"] = bool(is_code_mixed)
    elif mode is not None:
        event["is_code_mixed"] = mode == _CODEMIX_MODE

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

        Opens one WebSocket connection, spawns concurrent sender and receiver coroutines,
        and yields normalized partial and final events without blocking.

        Args:
            audio_chunks: Async iterable of raw audio byte chunks (WAV/PCM).
            is_final_chunk: If True, sends flush() after all chunks and marks
                            the final transcript event as is_final=True.

        Yields:
            Normalized ASR event dictionaries.

        Raises:
            SaarasStreamingError: On connection failure, server error, or API error.
        """
        queue: asyncio.Queue[Union[Dict[str, Any], Exception, object]] = asyncio.Queue()
        sender_done = asyncio.Event()
        flush_sent = asyncio.Event()

        connect_kwargs: Dict[str, Any] = {
            "language_code": self.language_code,
            "model": self.model,
            "mode": self.mode,
            "input_audio_codec": self.input_audio_codec,
            "sample_rate": str(self.sample_rate),
            "vad_signals": "true",
            "flush_signal": "true",
        }

        try:
            connect_cm = self._client.speech_to_text_streaming.connect(**connect_kwargs)
        except ApiError as err:
            raise SaarasStreamingError(
                f"Saaras streaming API error (status {err.status_code}): {err.body}"
            ) from err
        except Exception as err:
            raise SaarasStreamingError(
                f"Failed to initialize Saaras streaming connection: {err}"
            ) from err

        async with connect_cm as socket:

            async def _sender_task() -> None:
                try:
                    async for raw_bytes in audio_chunks:
                        if not raw_bytes:
                            continue
                        b64_audio = base64.b64encode(raw_bytes).decode("utf-8")
                        await socket.transcribe(
                            audio=b64_audio,
                            encoding=f"audio/{self.input_audio_codec}",
                            sample_rate=self.sample_rate,
                        )
                    sender_done.set()
                    if is_final_chunk:
                        await socket.flush()
                        flush_sent.set()
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    sender_done.set()
                    if is_final_chunk:
                        flush_sent.set()
                    await queue.put(exc)

            async def _receiver_task() -> None:
                socket_iter = aiter(socket)
                speech_ended = False
                last_event: Optional[Dict[str, Any]] = None
                final_emitted = False

                try:
                    while True:
                        if flush_sent.is_set():
                            timeout = _POST_FLUSH_DRAIN_TIMEOUT
                        elif sender_done.is_set():
                            timeout = 1.0
                        else:
                            timeout = None

                        try:
                            if timeout is not None:
                                resp = await asyncio.wait_for(anext(socket_iter), timeout=timeout)
                            else:
                                resp = await anext(socket_iter)
                        except (StopAsyncIteration, asyncio.TimeoutError):
                            break

                        resp_type = getattr(resp, "type", None)
                        data = getattr(resp, "data", None)

                        if resp_type == "error":
                            if hasattr(data, "error") and hasattr(data, "code"):
                                raise SaarasStreamingError(
                                    f"Saaras streaming server error [{data.code}]: {data.error}"
                                )
                            raise SaarasStreamingError(
                                f"Saaras streaming server returned error: {data!r}"
                            )

                        if resp_type == "events":
                            sig = getattr(data, "signal_type", None)
                            if sig == "END_SPEECH":
                                speech_ended = True
                            elif sig == "START_SPEECH":
                                speech_ended = False
                            continue

                        if resp_type == "data" and hasattr(data, "transcript"):
                            transcript = data.transcript or ""
                            lang_code = getattr(data, "language_code", None)
                            server_code_mix = getattr(data, "is_code_mixed", None)

                            if is_final_chunk:
                                # When is_final_chunk=True, all received items are partials
                                # until the stream is finalized after flush
                                evt_is_final = False
                            else:
                                # In continuous mode, mark final on utterance end
                                evt_is_final = speech_ended
                                if evt_is_final:
                                    speech_ended = False

                            evt = _normalize_streaming_event(
                                transcript=transcript,
                                session_id=self.session_id,
                                speaker_id=self.speaker_id,
                                is_final=evt_is_final,
                                language_code=lang_code,
                                is_code_mixed=server_code_mix,
                            )
                            last_event = evt
                            if evt_is_final:
                                final_emitted = True

                            await queue.put(evt)

                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    await queue.put(exc)
                    return
                finally:
                    # When is_final_chunk=True, promote the last received transcript to final
                    if is_final_chunk and not final_emitted and last_event is not None:
                        final_evt = dict(last_event)
                        final_evt["is_final"] = True
                        await queue.put(final_evt)
                        final_emitted = True
                    await queue.put(_SENTINEL)

            s_task = asyncio.create_task(_sender_task())
            r_task = asyncio.create_task(_receiver_task())

            try:
                while True:
                    item = await queue.get()
                    if item is _SENTINEL:
                        break
                    if isinstance(item, Exception):
                        if isinstance(item, (ApiError, SaarasStreamingError)):
                            raise item if isinstance(item, SaarasStreamingError) else SaarasStreamingError(str(item))
                        raise SaarasStreamingError(f"Unexpected error in streaming session: {item}") from item
                    yield item
            finally:
                s_task.cancel()
                r_task.cancel()
                await asyncio.gather(s_task, r_task, return_exceptions=True)
