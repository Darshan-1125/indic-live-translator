"""Unit tests for Stage 3 ASR normalization adapter in ai/integration."""

import unittest
from sarvamai.types import SpeechToTextResponse
from ai.integration.asr_adapter import (
    SaarasASRAdapter,
    extract_transcript_text,
    normalize_asr_result,
)


class TestASRNormalizationAdapter(unittest.TestCase):
    """Test suite for ASR normalization adapter."""

    def test_normalize_partial_result(self):
        """Test partial ASR result normalization (is_final=False)."""
        mock_response = {
            "transcript": "Naan meeting-ku",
            "language_code": "ta-IN",
        }

        event = normalize_asr_result(
            response=mock_response,
            session_id="session-xyz-123",
            speaker_id="speaker-tam-01",
            is_final=False,
        )

        # Output must contain exactly these 5 keys
        expected = {
            "type": "asr_partial",
            "session_id": "session-xyz-123",
            "speaker_id": "speaker-tam-01",
            "text": "Naan meeting-ku",
            "is_final": False,
        }
        self.assertEqual(event, expected)
        self.assertEqual(set(event.keys()), {"type", "session_id", "speaker_id", "text", "is_final"})

    def test_normalize_final_result(self):
        """Test final ASR result normalization (is_final=True)."""
        mock_response = {
            "transcript": "Naan meeting-ku late aagiten",
            "language_code": "ta-IN",
        }

        event = normalize_asr_result(
            response=mock_response,
            session_id="session-xyz-123",
            speaker_id="speaker-tam-01",
            is_final=True,
        )

        expected = {
            "type": "asr_partial",
            "session_id": "session-xyz-123",
            "speaker_id": "speaker-tam-01",
            "text": "Naan meeting-ku late aagiten",
            "is_final": True,
        }
        self.assertEqual(event, expected)
        self.assertEqual(set(event.keys()), {"type", "session_id", "speaker_id", "text", "is_final"})

    def test_normalize_sdk_response_object(self):
        """Test normalization with official Sarvam SDK SpeechToTextResponse object."""
        sdk_response = SpeechToTextResponse(
            transcript="வணக்கம் உலகமே",
            language_code="ta-IN",
            request_id="req-999",
        )

        event = normalize_asr_result(
            response=sdk_response,
            session_id="sess-456",
            speaker_id="spk-789",
            is_final=False,
        )

        self.assertEqual(event["text"], "வணக்கம் உலகமே")
        self.assertEqual(event["session_id"], "sess-456")
        self.assertEqual(event["speaker_id"], "spk-789")
        self.assertFalse(event["is_final"])

    def test_adapter_class_convenience(self):
        """Test SaarasASRAdapter class instance."""
        adapter = SaarasASRAdapter(session_id="sess-init", speaker_id="spk-init")
        event = adapter.normalize(
            response="Hello conversational speech",
            is_final=True,
        )

        self.assertEqual(
            event,
            {
                "type": "asr_partial",
                "session_id": "sess-init",
                "speaker_id": "spk-init",
                "text": "Hello conversational speech",
                "is_final": True,
            },
        )

    def test_missing_ids_raises_value_error(self):
        """Ensure caller must supply session_id and speaker_id."""
        with self.assertRaises(ValueError):
            normalize_asr_result("transcript", session_id="", speaker_id="spk-1")

        with self.assertRaises(ValueError):
            normalize_asr_result("transcript", session_id="sess-1", speaker_id="")


if __name__ == "__main__":
    unittest.main()
