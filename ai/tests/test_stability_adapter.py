"""Unit tests for Stage 5 Translation → Stability Engine adapter in ai/integration."""

import unittest
from unittest.mock import MagicMock

from ai.integration.stability_adapter import (
    TranslationStabilityAdapter,
    StabilityAdapter,
    StabilityAdapterError,
    adapt_translation_to_stability,
    stabilize_translation_event,
)


# ---------------------------------------------------------------------------
# Fake StabilityResult and FakeStabilityEngine
# (No dependency on backend package – duck typing only)
# ---------------------------------------------------------------------------

class _FakeStabilityResult:
    """Minimal StabilityResult-compatible object for testing."""

    def __init__(
        self,
        newly_committed_text: str = "",
        cumulative_committed_text: str = "",
        tentative_text: str = "",
        full_transcript: str = "",
        is_final: bool = False,
        stable_word_count: int = 0,
        tentative_word_count: int = 0,
    ):
        self.newly_committed_text = newly_committed_text
        self.cumulative_committed_text = cumulative_committed_text
        self.tentative_text = tentative_text
        self.full_transcript = full_transcript
        self.is_final = is_final
        self.stable_word_count = stable_word_count
        self.tentative_word_count = tentative_word_count


class _FakeStabilityEngine:
    """Minimal StabilityEngine-compatible object for testing."""

    def __init__(self, result: _FakeStabilityResult):
        self._result = result
        self.calls: list = []

    def process_partial(self, partial_text: str, is_final: bool = False) -> _FakeStabilityResult:
        self.calls.append({"partial_text": partial_text, "is_final": is_final})
        return self._result


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestTranslationStabilityAdapter(unittest.TestCase):
    """Test suite for Stage 5 TranslationStabilityAdapter."""

    def _make_translation_event(
        self,
        text: str = "Naan meeting-ku late aagiten",
        translated_text: str = "I got late to the meeting",
        session_id: str = "session-123",
        speaker_id: str = "user-a",
        is_final: bool = False,
    ) -> dict:
        return {
            "type": "translation",
            "session_id": session_id,
            "speaker_id": speaker_id,
            "text": text,
            "translated_text": translated_text,
            "is_final": is_final,
        }

    def test_partial_translation_event(self):
        """Partial translation events produce stable_translation with correct fields."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="I got",
            cumulative_committed_text="I got",
            tentative_text="late to the meeting",
            full_transcript="I got late to the meeting",
            is_final=False,
            stable_word_count=2,
            tentative_word_count=4,
        )
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(is_final=False)

        output = adapt_translation_to_stability(event=event, stability_engine=engine)

        # Output type
        self.assertEqual(output["type"], "stable_translation")
        # Pass-through fields
        self.assertEqual(output["session_id"], "session-123")
        self.assertEqual(output["speaker_id"], "user-a")
        self.assertFalse(output["is_final"])
        # Stability fields mapped correctly
        self.assertEqual(output["translated_text"], "I got late to the meeting")
        self.assertEqual(output["newly_committed_text"], "I got")
        self.assertEqual(output["tentative_text"], "late to the meeting")
        self.assertEqual(output["stable_word_count"], 2)
        self.assertEqual(output["tentative_word_count"], 4)
        # Engine was called with the translated text only
        self.assertEqual(len(engine.calls), 1)
        self.assertEqual(engine.calls[0]["partial_text"], "I got late to the meeting")
        self.assertFalse(engine.calls[0]["is_final"])

    def test_final_translation_event(self):
        """Final translation events pass is_final=True and tentative_text is empty."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="late to the meeting",
            cumulative_committed_text="I got late to the meeting",
            tentative_text="",
            full_transcript="I got late to the meeting",
            is_final=True,
            stable_word_count=6,
            tentative_word_count=0,
        )
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(
            translated_text="I got late to the meeting",
            is_final=True,
        )

        output = adapt_translation_to_stability(event=event, stability_engine=engine)

        self.assertEqual(output["type"], "stable_translation")
        self.assertTrue(output["is_final"])
        self.assertEqual(output["tentative_text"], "")
        self.assertEqual(output["translated_text"], "I got late to the meeting")
        self.assertEqual(output["stable_word_count"], 6)
        self.assertEqual(output["tentative_word_count"], 0)
        # Engine received is_final=True
        self.assertTrue(engine.calls[0]["is_final"])

    def test_stability_result_fields_mapped_correctly(self):
        """All StabilityResult fields are mapped to the correct output keys."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="Hello",
            cumulative_committed_text="Hello world",
            tentative_text="there",
            full_transcript="Hello world there",
            is_final=False,
            stable_word_count=2,
            tentative_word_count=1,
        )
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(translated_text="Hello world there")

        output = adapt_translation_to_stability(event=event, stability_engine=engine)

        expected_keys = {
            "type",
            "session_id",
            "speaker_id",
            "translated_text",
            "newly_committed_text",
            "tentative_text",
            "is_final",
            "stable_word_count",
            "tentative_word_count",
        }
        self.assertEqual(set(output.keys()), expected_keys)
        self.assertEqual(output["newly_committed_text"], "Hello")
        self.assertEqual(output["tentative_text"], "there")
        self.assertEqual(output["stable_word_count"], 2)
        self.assertEqual(output["tentative_word_count"], 1)

    def test_invalid_event_type_raises_value_error(self):
        """Non-translation event types must raise ValueError."""
        engine = MagicMock()
        bad_event = {
            "type": "asr_partial",       # wrong type
            "session_id": "s1",
            "speaker_id": "u1",
            "translated_text": "Some text",
            "is_final": False,
        }
        with self.assertRaises(ValueError) as ctx:
            adapt_translation_to_stability(event=bad_event, stability_engine=engine)
        self.assertIn("asr_partial", str(ctx.exception))
        engine.process_partial.assert_not_called()

    def test_non_dict_event_raises_type_error(self):
        """A non-dict event must raise TypeError immediately."""
        engine = MagicMock()
        with self.assertRaises(TypeError):
            adapt_translation_to_stability(event="not a dict", stability_engine=engine)  # type: ignore

    def test_empty_translated_text(self):
        """Empty translated_text is forwarded to engine; output reflects engine's result."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="",
            cumulative_committed_text="",
            tentative_text="",
            full_transcript="",
            is_final=False,
            stable_word_count=0,
            tentative_word_count=0,
        )
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(translated_text="")

        output = adapt_translation_to_stability(event=event, stability_engine=engine)

        self.assertEqual(output["type"], "stable_translation")
        self.assertEqual(output["translated_text"], "")
        self.assertEqual(output["newly_committed_text"], "")
        self.assertEqual(output["tentative_text"], "")
        self.assertEqual(output["stable_word_count"], 0)
        # Engine was still called (empty string is a valid partial in streaming)
        self.assertEqual(engine.calls[0]["partial_text"], "")

    def test_none_translated_text_treated_as_empty(self):
        """None translated_text should not crash; treated as empty string."""
        fake_result = _FakeStabilityResult()
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(translated_text=None)  # type: ignore

        output = adapt_translation_to_stability(event=event, stability_engine=engine)

        self.assertEqual(output["type"], "stable_translation")
        self.assertEqual(engine.calls[0]["partial_text"], "")

    def test_engine_failure_raises_stability_adapter_error(self):
        """Engine exceptions are wrapped as StabilityAdapterError."""
        engine = MagicMock()
        engine.process_partial.side_effect = RuntimeError("GPU OOM")

        event = self._make_translation_event()

        with self.assertRaises(StabilityAdapterError) as ctx:
            adapt_translation_to_stability(event=event, stability_engine=engine)

        self.assertIn("GPU OOM", str(ctx.exception))

    def test_class_adapter_inject_via_init(self):
        """TranslationStabilityAdapter accepts engine via __init__."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="I",
            tentative_text="go",
            full_transcript="I go",
            stable_word_count=1,
            tentative_word_count=1,
        )
        engine = _FakeStabilityEngine(fake_result)
        adapter = TranslationStabilityAdapter(stability_engine=engine)

        output = adapter.process(self._make_translation_event(translated_text="I go"))

        self.assertEqual(output["type"], "stable_translation")
        self.assertEqual(output["newly_committed_text"], "I")

    def test_class_adapter_inject_via_process(self):
        """TranslationStabilityAdapter accepts engine override in process()."""
        fake_result = _FakeStabilityResult(
            newly_committed_text="Hello",
            full_transcript="Hello world",
            stable_word_count=1,
        )
        engine = _FakeStabilityEngine(fake_result)
        adapter = TranslationStabilityAdapter()  # no engine at init

        output = adapter.process(
            self._make_translation_event(translated_text="Hello world"),
            stability_engine=engine,
        )
        self.assertEqual(output["newly_committed_text"], "Hello")

    def test_callable_shorthand(self):
        """Calling the adapter instance directly delegates to process()."""
        fake_result = _FakeStabilityResult(
            full_transcript="Good morning",
            newly_committed_text="Good",
            tentative_text="morning",
            stable_word_count=1,
            tentative_word_count=1,
        )
        engine = _FakeStabilityEngine(fake_result)
        adapter = TranslationStabilityAdapter(stability_engine=engine)

        output = adapter(self._make_translation_event(translated_text="Good morning"))
        self.assertEqual(output["type"], "stable_translation")
        self.assertEqual(output["tentative_text"], "morning")

    def test_stability_adapter_alias(self):
        """StabilityAdapter is a valid alias for TranslationStabilityAdapter."""
        self.assertIs(StabilityAdapter, TranslationStabilityAdapter)

    def test_stabilize_translation_event_alias(self):
        """stabilize_translation_event is an alias for adapt_translation_to_stability."""
        self.assertIs(stabilize_translation_event, adapt_translation_to_stability)

    def test_original_event_not_mutated(self):
        """The adapter must not modify the original translation event dict."""
        fake_result = _FakeStabilityResult(
            full_transcript="test",
            newly_committed_text="test",
        )
        engine = _FakeStabilityEngine(fake_result)
        event = self._make_translation_event(translated_text="test")
        original_copy = dict(event)

        adapt_translation_to_stability(event=event, stability_engine=engine)

        self.assertEqual(event, original_copy)

    def test_no_engine_raises_value_error(self):
        """Calling process() with no engine anywhere raises ValueError."""
        adapter = TranslationStabilityAdapter()
        with self.assertRaises(ValueError):
            adapter.process(self._make_translation_event())


if __name__ == "__main__":
    unittest.main()
