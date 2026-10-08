"""Unit tests for Sarvam AI pipeline services."""

import base64
import os
import unittest
from unittest.mock import MagicMock

from sarvamai.core.api_error import ApiError
from sarvamai.types import (
    SpeechToTextResponse,
    TextToSpeechResponse,
    TranslationResponse,
)
from ai.services.saras import SaarasSpeechToTextService, SaarasSTTError
from ai.services.translation import SarvamTranslationService, SarvamTranslationError
from ai.services.tts import BulbulTTSService, BulbulTTSError


class TestSaarasSpeechToTextService(unittest.TestCase):
    """Test suite for SaarasSpeechToTextService."""

    def test_missing_api_key_raises_value_error(self):
        old_env = os.environ.pop("SARVAM_API_KEY", None)
        try:
            with self.assertRaises(ValueError):
                SaarasSpeechToTextService()
        finally:
            if old_env:
                os.environ["SARVAM_API_KEY"] = old_env

    def test_transcribe_with_mocked_client(self):
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.return_value = SpeechToTextResponse(
            transcript="வணக்கம் உலகமே",
            language_code="ta-IN",
            request_id="req-stt-1",
        )

        service = SaarasSpeechToTextService(client=mock_client)
        result = service.transcribe(
            audio=b"dummy_wav_bytes",
            language_code="ta-IN",
            output_mode="codemix",
        )

        self.assertEqual(result["transcript"], "வணக்கம் உலகமே")
        self.assertEqual(result["language_code"], "ta-IN")
        self.assertEqual(result["request_id"], "req-stt-1")

    def test_transcribe_api_error_wrapped(self):
        mock_client = MagicMock()
        mock_client.speech_to_text.transcribe.side_effect = ApiError(
            status_code=401, body="Unauthorized"
        )
        service = SaarasSpeechToTextService(client=mock_client)

        with self.assertRaises(SaarasSTTError):
            service.transcribe(audio=b"test")


class TestSarvamTranslationService(unittest.TestCase):
    """Test suite for SarvamTranslationService."""

    def test_default_mode_is_modern_colloquial(self):
        mock_client = MagicMock()
        mock_client.text.translate.return_value = TranslationResponse(
            translated_text="Hi there",
            source_language_code="ta-IN",
            request_id="req-tr-1",
        )

        service = SarvamTranslationService(client=mock_client)
        self.assertEqual(service.DEFAULT_MODE, "modern-colloquial")

        res = service.translate(text="வணக்கம்")
        self.assertEqual(res["translated_text"], "Hi there")

        _, kwargs = mock_client.text.translate.call_args
        self.assertEqual(kwargs["mode"], "modern-colloquial")
        self.assertEqual(kwargs["model"], "mayura:v1")

    def test_same_source_target_short_circuits(self):
        mock_client = MagicMock()
        service = SarvamTranslationService(client=mock_client)

        res = service.translate(
            text="Hello world",
            source_language_code="en-IN",
            target_language_code="en-IN",
        )
        self.assertEqual(res["translated_text"], "Hello world")
        mock_client.text.translate.assert_not_called()

    def test_empty_text_raises_value_error(self):
        mock_client = MagicMock()
        service = SarvamTranslationService(client=mock_client)
        with self.assertRaises(ValueError):
            service.translate(text="   ")


class TestBulbulTTSService(unittest.TestCase):
    """Test suite for BulbulTTSService."""

    def test_defaults_and_sample_rate(self):
        mock_client = MagicMock()
        dummy_audio = base64.b64encode(b"SYNTHESIZED_AUDIO").decode("utf-8")
        mock_client.text_to_speech.convert.return_value = TextToSpeechResponse(
            audios=[dummy_audio],
            request_id="req-tts-1",
        )

        service = BulbulTTSService(client=mock_client)
        self.assertEqual(service.DEFAULT_SPEAKER, "ratan")

        result = service.synthesize(text="வணக்கம்")
        self.assertEqual(result["audio_bytes"], b"SYNTHESIZED_AUDIO")
        self.assertEqual(result["speaker"], "ratan")
        self.assertEqual(result["sample_rate"], 24000)
        self.assertEqual(result["codec"], "wav")

    def test_text_length_exceeded_raises_value_error(self):
        mock_client = MagicMock()
        service = BulbulTTSService(client=mock_client)
        with self.assertRaises(ValueError):
            service.synthesize(text="A" * 2501)


if __name__ == "__main__":
    unittest.main()
