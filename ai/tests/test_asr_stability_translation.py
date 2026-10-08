"""Unit tests for the end-to-end ASR → Backend Stability → Translation pipeline.

All unit tests use mock/fake services without calling external APIs.
"""

import asyncio
import unittest
from typing import Any, AsyncIterator, Dict, List, Optional
from unittest.mock import MagicMock, patch

from backend.app.services.stability import StabilityAdapter, StabilityConfig
from ai.integration.asr_translation_pipeline import (
    ASRStabilityTranslationPipeline,
    process_asr_to_stable_translation,
)
from ai.services.translation import SarvamTranslationError, SarvamTranslationService


class _FakeTranslationService:
    """Mock translation service returning predictable translations."""

    def __init__(self, translation_map: Optional[Dict[str, str]] = None, fail_on_text: Optional[str] = None):
        self.translation_map = translation_map or {
            "நான்": "I",
            "நான் இன்னைக்கு": "I today",
            "நான் இன்னைக்கு homework பண்ணேன்.": "I did homework today.",
            "Meeting எத்தனை மணிக்கு?": "What time is the meeting?",
            "Vanakkam everyone, எப்படி இருக்கீங்க?": "Hello everyone, how are you?",
            "Good morning": "Good morning",
            "வணக்கம்": "Hello",
        }
        self.fail_on_text = fail_on_text
        self.call_count = 0
        self.last_translated_text = ""

    def translate(
        self,
        text: str,
        source_language_code: str = "ta-IN",
        target_language_code: str = "en-IN",
        mode: str = "modern-colloquial",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        self.call_count += 1
        self.last_translated_text = text

        if self.fail_on_text and self.fail_on_text in text:
            raise SarvamTranslationError("Simulated Sarvam translation API error")

        translated = self.translation_map.get(text, f"Translated: {text}")
        return {
            "translated_text": translated,
            "source_language_code": source_language_code,
            "target_language_code": target_language_code,
            "request_id": f"mock-req-{self.call_count}",
        }


class _FakeStreamer:
    """Mock Saaras streaming ASR yielding a predefined sequence of ASR events."""

    def __init__(self, events: List[Dict[str, Any]]):
        self.events = events

    async def stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        *,
        is_final_chunk: bool = False,
    ) -> AsyncIterator[Dict[str, Any]]:
        # Consume incoming audio chunks
        async for _ in audio_chunks:
            pass
        for evt in self.events:
            yield evt


class TestASRStabilityTranslationPipeline(unittest.IsolatedAsyncioTestCase):
    """Test suite for ASR → Backend Stability → Translation integration."""

    def setUp(self):
        self.stability_adapter = StabilityAdapter(config=StabilityConfig(min_stability_count=2))
        self.translator = _FakeTranslationService()
        self.pipeline = ASRStabilityTranslationPipeline(
            translation_service=self.translator,
            stability_adapter=self.stability_adapter,
            source_language_code="ta-IN",
            target_language_code="en-IN",
        )

    def test_asr_to_stability_integration(self):
        """Verify ASR events correctly feed into Backend StabilityAdapter."""
        asr_event = {
            "type": "asr_partial",
            "session_id": "sess-101",
            "speaker_id": "spk-001",
            "text": "நான் இன்னைக்கு homework பண்ணேன்.",
            "is_final": True,
            "language_code": "ta-IN",
        }
        result = self.pipeline.process_asr_event(asr_event)

        self.assertIn("stability", result)
        stab = result["stability"]
        self.assertTrue(stab["is_final"])
        self.assertEqual(stab["cumulative_committed_text"], "நான் இன்னைக்கு homework பண்ணேன்.")
        self.assertEqual(stab["tentative_text"], "")

    def test_stability_to_translation_integration(self):
        """Verify stable/full text from Stability flows into Translation."""
        asr_event = {
            "type": "asr_partial",
            "session_id": "sess-102",
            "speaker_id": "spk-002",
            "text": "நான் இன்னைக்கு homework பண்ணேன்.",
            "is_final": True,
            "language_code": "ta-IN",
        }
        result = self.pipeline.process_asr_event(asr_event)

        self.assertEqual(result["type"], "translation")
        self.assertEqual(result["translated_text"], "I did homework today.")
        self.assertTrue(result["is_final"])

    def test_tamil_transcript_flow(self):
        """Test pure Tamil script translation."""
        self.translator.translation_map["வணக்கம்"] = "Hello"
        asr_event = {
            "type": "asr_partial",
            "session_id": "sess-tamil",
            "speaker_id": "spk-tamil",
            "text": "வணக்கம்",
            "is_final": True,
            "language_code": "ta-IN",
        }
        result = self.pipeline.process_asr_event(asr_event)
        self.assertEqual(result["text"], "வணக்கம்")
        self.assertEqual(result["translated_text"], "Hello")

    def test_english_transcript_flow(self):
        """Test English transcript flow."""
        asr_event = {
            "type": "asr_partial",
            "session_id": "sess-en",
            "speaker_id": "spk-en",
            "text": "Good morning",
            "is_final": True,
            "language_code": "en-IN",
        }
        result = self.pipeline.process_asr_event(asr_event)
        self.assertEqual(result["text"], "Good morning")
        self.assertEqual(result["translated_text"], "Good morning")

    def test_tamil_english_code_mix(self):
        """Test Tamil-English code-mixed transcript (Tanglish)."""
        asr_event = {
            "type": "asr_partial",
            "session_id": "sess-tanglish",
            "speaker_id": "spk-tanglish",
            "text": "Meeting எத்தனை மணிக்கு?",
            "is_final": True,
            "language_code": "ta-IN",
        }
        result = self.pipeline.process_asr_event(asr_event)
        self.assertEqual(result["text"], "Meeting எத்தனை மணிக்கு?")
        self.assertEqual(result["translated_text"], "What time is the meeting?")

    def test_partial_events(self):
        """Test partial ASR events flow through stability with is_final=False."""
        partial_1 = {
            "type": "asr_partial",
            "session_id": "sess-seq",
            "speaker_id": "spk-seq",
            "text": "நான்",
            "is_final": False,
        }
        res1 = self.pipeline.process_asr_event(partial_1)
        self.assertFalse(res1["is_final"])
        self.assertEqual(res1["text"], "நான்")
        self.assertEqual(res1["translated_text"], "I")
        self.assertEqual(res1["stability"]["tentative_text"], "நான்")
        self.assertEqual(res1["stability"]["cumulative_committed_text"], "")

    def test_final_events(self):
        """Test final event locks all words in stability and marks is_final=True."""
        final_event = {
            "type": "asr_partial",
            "session_id": "sess-final",
            "speaker_id": "spk-final",
            "text": "நான் இன்னைக்கு homework பண்ணேன்.",
            "is_final": True,
        }
        res = self.pipeline.process_asr_event(final_event)
        self.assertTrue(res["is_final"])
        self.assertEqual(res["translated_text"], "I did homework today.")
        self.assertEqual(res["stability"]["tentative_text"], "")
        self.assertTrue(res["stability"]["is_final"])

    def test_empty_transcript(self):
        """Empty transcript chunks should not call the translation API."""
        initial_calls = self.translator.call_count
        empty_event = {
            "type": "asr_partial",
            "session_id": "sess-empty",
            "speaker_id": "spk-empty",
            "text": "",
            "is_final": False,
        }
        result = self.pipeline.process_asr_event(empty_event)

        self.assertEqual(result["type"], "translation")
        self.assertEqual(result["text"], "")
        self.assertEqual(result["translated_text"], "")
        self.assertFalse(result["is_final"])
        # No extra call to translation service
        self.assertEqual(self.translator.call_count, initial_calls)

    def test_translation_failure_handling(self):
        """Translation failures are wrapped as SarvamTranslationError or handled safely."""
        self.translator.fail_on_text = "error_trigger"
        failing_event = {
            "type": "asr_partial",
            "session_id": "sess-err",
            "speaker_id": "spk-err",
            "text": "error_trigger word",
            "is_final": False,
        }

        # By default, fail_silently is False, so it raises
        with self.assertRaises(SarvamTranslationError):
            self.pipeline.process_asr_event(failing_event)

        # When fail_silently is True, returns empty translation gracefully
        safe_pipeline = ASRStabilityTranslationPipeline(
            translation_service=self.translator,
            stability_adapter=self.stability_adapter,
            fail_silently=True,
        )
        res = safe_pipeline.process_asr_event(failing_event)
        self.assertEqual(res["type"], "translation")
        self.assertEqual(res["translated_text"], "")

    def test_session_and_speaker_id_preserved(self):
        """Verify session_id and speaker_id are preserved throughout the pipeline."""
        event = {
            "type": "asr_partial",
            "session_id": "custom-session-999",
            "speaker_id": "custom-speaker-888",
            "text": "வணக்கம்",
            "is_final": False,
        }
        result = self.pipeline.process_asr_event(event)
        self.assertEqual(result["session_id"], "custom-session-999")
        self.assertEqual(result["speaker_id"], "custom-speaker-888")

    async def test_stream_audio_end_to_end(self):
        """Test streaming audio chunks end-to-end to translation events."""
        fake_events = [
            {
                "type": "asr_partial",
                "session_id": "sess-stream",
                "speaker_id": "spk-stream",
                "text": "நான்",
                "is_final": False,
            },
            {
                "type": "asr_partial",
                "session_id": "sess-stream",
                "speaker_id": "spk-stream",
                "text": "நான் இன்னைக்கு homework பண்ணேன்.",
                "is_final": True,
            },
        ]
        streamer = _FakeStreamer(fake_events)

        async def _audio_gen():
            yield b"chunk1"
            yield b"chunk2"

        results = []
        async for trans_event in self.pipeline.stream_audio(
            _audio_gen(),
            session_id="sess-stream",
            speaker_id="spk-stream",
            is_final_chunk=True,
            streamer=streamer,
        ):
            results.append(trans_event)

        self.assertEqual(len(results), 2)
        # First event is partial
        self.assertFalse(results[0]["is_final"])
        self.assertEqual(results[0]["text"], "நான்")
        self.assertEqual(results[0]["translated_text"], "I")
        self.assertEqual(results[0]["session_id"], "sess-stream")

        # Second event is final
        self.assertTrue(results[1]["is_final"])
        self.assertEqual(results[1]["text"], "நான் இன்னைக்கு homework பண்ணேன்.")
        self.assertEqual(results[1]["translated_text"], "I did homework today.")
        self.assertEqual(results[1]["session_id"], "sess-stream")


if __name__ == "__main__":
    unittest.main()
