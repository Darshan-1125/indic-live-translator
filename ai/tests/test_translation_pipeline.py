"""Unit tests for Stage 4 ASR to Translation pipeline in ai/integration."""

import unittest
from unittest.mock import MagicMock

from ai.integration.translation_pipeline import (
    ASRTranslationPipeline,
    TranslationPipeline,
    translate_asr_event,
)
from ai.services.translation import SarvamTranslationError


class TestASRTranslationPipeline(unittest.TestCase):
    """Test suite for ASR to Translation integration pipeline."""

    def setUp(self):
        self.mock_service = MagicMock()
        self.pipeline = ASRTranslationPipeline(translation_service=self.mock_service)

    def test_partial_asr_event_to_translated_result(self):
        """Test partial ASR event with code-mixed text translating to English."""
        self.mock_service.translate.return_value = {
            "translated_text": "I got late to the meeting",
            "source_language_code": "ta-IN",
            "request_id": "req-trans-001",
        }

        asr_partial_event = {
            "type": "asr_partial",
            "session_id": "session-123",
            "speaker_id": "user-a",
            "text": "Naan meeting-ku late aagiten",
            "is_final": False,
        }

        output = self.pipeline.process(asr_partial_event)

        expected = {
            "type": "translation",
            "session_id": "session-123",
            "speaker_id": "user-a",
            "text": "Naan meeting-ku late aagiten",
            "translated_text": "I got late to the meeting",
            "is_final": False,
        }
        self.assertEqual(output, expected)

        # Verify underlying translation service call parameters
        self.mock_service.translate.assert_called_once_with(
            text="Naan meeting-ku late aagiten",
            source_language_code="ta-IN",
            target_language_code="en-IN",
        )

    def test_final_asr_event_to_translated_result(self):
        """Test final ASR event translating and preserving is_final=True."""
        self.mock_service.translate.return_value = {
            "translated_text": "I will reach home in ten minutes",
            "source_language_code": "ta-IN",
            "request_id": "req-trans-002",
        }

        asr_final_event = {
            "type": "asr_partial",
            "session_id": "session-456",
            "speaker_id": "user-b",
            "text": "Naan pathu nimishathula veetuku poiduven",
            "is_final": True,
        }

        output = self.pipeline.process(asr_final_event)

        self.assertEqual(output["type"], "translation")
        self.assertEqual(output["session_id"], "session-456")
        self.assertEqual(output["speaker_id"], "user-b")
        self.assertEqual(output["text"], "Naan pathu nimishathula veetuku poiduven")
        self.assertEqual(output["translated_text"], "I will reach home in ten minutes")
        self.assertTrue(output["is_final"])

    def test_tamil_pure_script_translation(self):
        """Test translation of native Tamil script transcript."""
        self.mock_service.translate.return_value = {
            "translated_text": "Hello, how are you?",
            "source_language_code": "ta-IN",
            "request_id": "req-trans-003",
        }

        event = {
            "type": "asr_partial",
            "session_id": "sess-tamil",
            "speaker_id": "spk-tamil",
            "text": "வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?",
            "is_final": True,
        }

        output = self.pipeline.process(event)

        self.assertEqual(output["translated_text"], "Hello, how are you?")
        self.assertEqual(output["text"], "வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?")
        self.mock_service.translate.assert_called_once_with(
            text="வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?",
            source_language_code="ta-IN",
            target_language_code="en-IN",
        )

    def test_empty_text_handling(self):
        """Test handling of empty string, whitespace-only, and None text values."""
        empty_cases = [
            {"type": "asr_partial", "session_id": "s1", "speaker_id": "u1", "text": "", "is_final": False},
            {"type": "asr_partial", "session_id": "s1", "speaker_id": "u1", "text": "   ", "is_final": False},
            {"type": "asr_partial", "session_id": "s1", "speaker_id": "u1", "text": None, "is_final": True},
        ]

        for case in empty_cases:
            output = self.pipeline.process(case)
            self.assertEqual(output["type"], "translation")
            self.assertEqual(output["session_id"], "s1")
            self.assertEqual(output["speaker_id"], "u1")
            self.assertEqual(output["translated_text"], "")
            self.assertEqual(output["is_final"], case["is_final"])

        # Service should never have been invoked for empty or whitespace text
        self.mock_service.translate.assert_not_called()

    def test_translation_service_failure_handling(self):
        """Test translation service API failure propagation."""
        self.mock_service.translate.side_effect = SarvamTranslationError(
            "Sarvam Translation API error (status 500): Internal Server Error"
        )

        event = {
            "type": "asr_partial",
            "session_id": "session-123",
            "speaker_id": "user-a",
            "text": "Naan meeting-ku late aagiten",
            "is_final": False,
        }

        with self.assertRaises(SarvamTranslationError) as ctx:
            self.pipeline.process(event)

        self.assertIn("Internal Server Error", str(ctx.exception))

    def test_unexpected_service_exception_wrapped(self):
        """Test unexpected exceptions during translation are wrapped into SarvamTranslationError."""
        self.mock_service.translate.side_effect = ConnectionResetError("Connection dropped")

        event = {
            "type": "asr_partial",
            "session_id": "session-123",
            "speaker_id": "user-a",
            "text": "Naan meeting-ku late aagiten",
            "is_final": False,
        }

        with self.assertRaises(SarvamTranslationError) as ctx:
            self.pipeline.process(event)

        self.assertIn("Translation pipeline failed during translation", str(ctx.exception))

    def test_callable_instance_and_alias(self):
        """Test pipeline __call__ shorthand and TranslationPipeline alias."""
        self.mock_service.translate.return_value = {"translated_text": "Welcome"}
        pipeline_alias = TranslationPipeline(translation_service=self.mock_service)

        event = {
            "type": "asr_partial",
            "session_id": "s-alias",
            "speaker_id": "u-alias",
            "text": "Varuga",
            "is_final": True,
        }

        res = pipeline_alias(event)
        self.assertEqual(res["translated_text"], "Welcome")
        self.assertTrue(res["is_final"])

    def test_standalone_translate_asr_event_function(self):
        """Test translate_asr_event functional entrypoint."""
        self.mock_service.translate.return_value = {"translated_text": "Good morning"}

        event = {
            "type": "asr_partial",
            "session_id": "s-func",
            "speaker_id": "u-func",
            "text": "Kaalai vanakkam",
            "is_final": False,
        }

        res = translate_asr_event(event=event, translation_service=self.mock_service)
        self.assertEqual(res["translated_text"], "Good morning")
        self.assertEqual(res["speaker_id"], "u-func")

    def test_invalid_event_type_raises_type_error(self):
        """Test non-dict event parameter raises TypeError."""
        with self.assertRaises(TypeError):
            self.pipeline.process("not a dict")  # type: ignore


if __name__ == "__main__":
    unittest.main()
