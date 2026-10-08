"""Unit tests for Saaras v4 real-time streaming ASR adapter.

All tests use fake/mock objects – no real Sarvam API calls are made.
"""

import asyncio
import unittest
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List, Optional
from unittest.mock import AsyncMock, MagicMock

from ai.services.saras_streaming import (
    SaarasStreamingASR,
    SaarasStreamingError,
    _normalize_streaming_event,
)


# ---------------------------------------------------------------------------
# Fake SDK types (duck-typed, no hard backend import)
# ---------------------------------------------------------------------------

class _FakeTranscriptionData:
    """Mimics sarvamai.types.SpeechToTextTranscriptionData."""

    def __init__(self, transcript: str, language_code: Optional[str] = None):
        self.transcript = transcript
        self.language_code = language_code
        self.request_id = "req-fake-001"
        self.timestamps = None
        self.diarized_transcript = None
        self.language_probability = None


class _FakeErrorData:
    """Mimics sarvamai.types.ErrorData."""

    def __init__(self, error: str = "server error", code: str = "E500"):
        self.error = error
        self.code = code


class _FakeEventsData:
    """Mimics sarvamai.types.EventsData (VAD signals)."""

    def __init__(self, event_type: str = "speech_start"):
        self.event_type = event_type


class _FakeStreamingResponse:
    """Mimics sarvamai.types.SpeechToTextStreamingResponse."""

    def __init__(self, type_: str, data: Any):
        self.type = type_
        self.data = data


# ---------------------------------------------------------------------------
# Fake async socket client
# ---------------------------------------------------------------------------

class _FakeAsyncSocket:
    """Fake AsyncSpeechToTextStreamingSocketClient."""

    def __init__(self, responses: List[_FakeStreamingResponse]):
        self._responses = responses
        self.transcribed_chunks: List[dict] = []
        self.flushed: bool = False

    async def transcribe(self, audio: str, encoding: str = "audio/wav", sample_rate: int = 16000):
        self.transcribed_chunks.append({"audio": audio, "encoding": encoding, "sample_rate": sample_rate})

    async def flush(self):
        self.flushed = True

    def __aiter__(self):
        return _AsyncListIter(self._responses)


class _AsyncListIter:
    def __init__(self, items):
        self._items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._items)
        except StopIteration:
            raise StopAsyncIteration


# ---------------------------------------------------------------------------
# Fake AsyncSarvamAI client
# ---------------------------------------------------------------------------

def _make_fake_client(responses: List[_FakeStreamingResponse]) -> tuple:
    """Create a fake AsyncSarvamAI client and associated socket."""
    socket = _FakeAsyncSocket(responses)

    class _FakeStreamingNamespace:
        @asynccontextmanager
        async def connect(self, **kwargs):
            yield socket

    class _FakeAsyncSarvamAI:
        def __init__(self):
            self.speech_to_text_streaming = _FakeStreamingNamespace()

    return _FakeAsyncSarvamAI(), socket


# ---------------------------------------------------------------------------
# Helper to collect all events from stream()
# ---------------------------------------------------------------------------

async def _collect(streamer: SaarasStreamingASR, chunks: List[bytes], is_final: bool = False):
    async def _gen():
        for c in chunks:
            yield c

    events = []
    async for evt in streamer.stream(_gen(), is_final_chunk=is_final):
        events.append(evt)
    return events


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestNormalizeStreamingEvent(unittest.TestCase):
    """Unit tests for the _normalize_streaming_event helper."""

    def test_codemix_mode_sets_is_code_mixed_true(self):
        evt = _normalize_streaming_event(
            transcript="Naan meeting-ku late aagiten",
            session_id="s1",
            speaker_id="u1",
            is_final=False,
            language_code="ta-IN",
            mode="codemix",
        )
        self.assertTrue(evt["is_code_mixed"])

    def test_transcribe_mode_sets_is_code_mixed_false(self):
        evt = _normalize_streaming_event(
            transcript="வணக்கம்",
            session_id="s1",
            speaker_id="u1",
            is_final=False,
            language_code="ta-IN",
            mode="transcribe",
        )
        self.assertFalse(evt["is_code_mixed"])

    def test_language_code_included_when_provided(self):
        evt = _normalize_streaming_event(
            transcript="hello",
            session_id="s1",
            speaker_id="u1",
            is_final=False,
            language_code="en-IN",
            mode="transcribe",
        )
        self.assertEqual(evt["language_code"], "en-IN")

    def test_language_code_omitted_when_none(self):
        evt = _normalize_streaming_event(
            transcript="hello",
            session_id="s1",
            speaker_id="u1",
            is_final=False,
            language_code=None,
            mode="transcribe",
        )
        self.assertNotIn("language_code", evt)

    def test_mandatory_fields_always_present(self):
        evt = _normalize_streaming_event(
            transcript="test",
            session_id="sess",
            speaker_id="spk",
            is_final=True,
            language_code=None,
            mode="codemix",
        )
        for field in ("type", "session_id", "speaker_id", "text", "is_final"):
            self.assertIn(field, evt)
        self.assertEqual(evt["type"], "asr_partial")


class TestSaarasStreamingASR(unittest.IsolatedAsyncioTestCase):
    """Async tests for SaarasStreamingASR using fake SDK objects."""

    def _make_streamer(self, responses: List[_FakeStreamingResponse], session_id="sess-1", speaker_id="spk-1"):
        client, socket = _make_fake_client(responses)
        streamer = SaarasStreamingASR(
            async_client=client,
            session_id=session_id,
            speaker_id=speaker_id,
            language_code="ta-IN",
            mode="codemix",
        )
        return streamer, socket

    async def test_partial_streaming_result(self):
        """Partial audio chunk produces asr_partial event with is_final=False."""
        responses = [
            _FakeStreamingResponse(
                "data",
                _FakeTranscriptionData("Naan meeting-ku", language_code="ta-IN"),
            )
        ]
        streamer, _ = self._make_streamer(responses)
        events = await _collect(streamer, [b"chunk1"], is_final=False)

        self.assertEqual(len(events), 1)
        evt = events[0]
        self.assertEqual(evt["type"], "asr_partial")
        self.assertEqual(evt["text"], "Naan meeting-ku")
        self.assertFalse(evt["is_final"])
        self.assertEqual(evt["session_id"], "sess-1")
        self.assertEqual(evt["speaker_id"], "spk-1")

    async def test_final_streaming_result(self):
        """is_final_chunk=True triggers flush and yields the last event as is_final=True."""
        responses = [
            _FakeStreamingResponse(
                "data",
                _FakeTranscriptionData("Naan meeting-ku late aagiten", language_code="ta-IN"),
            )
        ]
        streamer, socket = self._make_streamer(responses)
        events = await _collect(streamer, [b"last_chunk"], is_final=True)

        # flush must have been called
        self.assertTrue(socket.flushed)

        # Last event must be final
        final_evt = events[-1]
        self.assertTrue(final_evt["is_final"])
        self.assertEqual(final_evt["type"], "asr_partial")
        self.assertEqual(final_evt["text"], "Naan meeting-ku late aagiten")

    async def test_tamil_tanglish_text(self):
        """Tamil and Tanglish (Tamil-English code-mixed) text preserved correctly."""
        tamil_text = "வணக்கம், எப்படி இருக்கிறீர்கள்?"
        tanglish_text = "Naan late aagiten"

        for text in (tamil_text, tanglish_text):
            responses = [
                _FakeStreamingResponse("data", _FakeTranscriptionData(text, language_code="ta-IN"))
            ]
            streamer, _ = self._make_streamer(responses)
            events = await _collect(streamer, [b"audio"], is_final=False)
            self.assertEqual(events[0]["text"], text)

    async def test_session_id_preserved(self):
        """session_id from constructor is present in every normalized event."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("hello"))
        ]
        streamer, _ = self._make_streamer(responses, session_id="session-XYZ")
        events = await _collect(streamer, [b"a"], is_final=False)
        self.assertEqual(events[0]["session_id"], "session-XYZ")

    async def test_speaker_id_preserved(self):
        """speaker_id from constructor is present in every normalized event."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("hello"))
        ]
        streamer, _ = self._make_streamer(responses, speaker_id="speaker-ABC")
        events = await _collect(streamer, [b"a"], is_final=False)
        self.assertEqual(events[0]["speaker_id"], "speaker-ABC")

    async def test_language_code_metadata_when_available(self):
        """language_code from SDK response is forwarded when present."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("hello", language_code="en-IN"))
        ]
        streamer, _ = self._make_streamer(responses)
        events = await _collect(streamer, [b"a"], is_final=False)
        self.assertEqual(events[0].get("language_code"), "en-IN")

    async def test_missing_optional_metadata(self):
        """When language_code is None, 'language_code' key is omitted from event."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("hello", language_code=None))
        ]
        streamer, _ = self._make_streamer(responses)
        events = await _collect(streamer, [b"a"], is_final=False)
        # is_code_mixed always present; language_code absent when None
        self.assertIn("is_code_mixed", events[0])
        self.assertNotIn("language_code", events[0])

    async def test_vad_events_skipped_silently(self):
        """VAD 'events' frames produce no normalized events."""
        responses = [
            _FakeStreamingResponse("events", _FakeEventsData("speech_start")),
            _FakeStreamingResponse("data", _FakeTranscriptionData("text here")),
            _FakeStreamingResponse("events", _FakeEventsData("speech_end")),
        ]
        streamer, _ = self._make_streamer(responses)
        events = await _collect(streamer, [b"a"], is_final=False)
        # Only the one "data" frame should produce an event
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["text"], "text here")

    async def test_stream_api_error_handling(self):
        """Server 'error' response raises SaarasStreamingError."""
        responses = [
            _FakeStreamingResponse("error", _FakeErrorData("bad audio", "E400"))
        ]
        streamer, _ = self._make_streamer(responses)

        with self.assertRaises(SaarasStreamingError) as ctx:
            await _collect(streamer, [b"bad"], is_final=False)

        self.assertIn("bad audio", str(ctx.exception))

    async def test_multiple_chunks_all_sent(self):
        """All audio chunks are forwarded to socket.transcribe()."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("word"))
        ]
        streamer, socket = self._make_streamer(responses)
        chunks = [b"chunk1", b"chunk2", b"chunk3"]
        await _collect(streamer, chunks, is_final=False)
        self.assertEqual(len(socket.transcribed_chunks), 3)

    async def test_empty_chunk_skipped(self):
        """Empty byte chunks are not forwarded to the socket."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("word"))
        ]
        streamer, socket = self._make_streamer(responses)
        await _collect(streamer, [b"real", b"", b"also_real"], is_final=False)
        self.assertEqual(len(socket.transcribed_chunks), 2)

    async def test_multiple_responses_emitted_in_order(self):
        """Multiple transcript responses are yielded in order."""
        responses = [
            _FakeStreamingResponse("data", _FakeTranscriptionData("Naan")),
            _FakeStreamingResponse("data", _FakeTranscriptionData("Naan meeting-ku")),
            _FakeStreamingResponse("data", _FakeTranscriptionData("Naan meeting-ku late")),
        ]
        streamer, _ = self._make_streamer(responses)
        events = await _collect(streamer, [b"a"], is_final=False)
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["text"], "Naan")
        self.assertEqual(events[1]["text"], "Naan meeting-ku")
        self.assertEqual(events[2]["text"], "Naan meeting-ku late")

    async def test_no_api_key_raises_value_error(self):
        """Missing API key with no injected client raises ValueError."""
        import os
        old_key = os.environ.pop("SARVAM_API_KEY", None)
        try:
            with self.assertRaises(ValueError):
                SaarasStreamingASR(session_id="s", speaker_id="u")
        finally:
            if old_key:
                os.environ["SARVAM_API_KEY"] = old_key


if __name__ == "__main__":
    unittest.main()
