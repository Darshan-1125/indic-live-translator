import unittest
from app.services.stability.config import StabilityConfig
from app.services.stability.models import StabilityResult
from app.services.stability.engine import StabilityEngine


class TestSimulatedASRSequence(unittest.TestCase):
    """
    Test suite matching the user's specific simulated ASR streaming transcript sequence:
    1. "Naan"
    2. "Naan meeting"
    3. "Naan meeting-ku"
    4. "Naan meeting-ku late"
    5. "Naan meeting-ku late aagiten"
    """

    def test_simulated_tamil_asr_sequence(self):
        engine = StabilityEngine(StabilityConfig(min_stability_count=2))

        # Update 1: "Naan"
        res1 = engine.process_partial("Naan")
        self.assertEqual(res1.newly_committed_text, "")
        self.assertEqual(res1.cumulative_committed_text, "")
        self.assertEqual(res1.tentative_text, "Naan")
        self.assertEqual(res1.full_transcript, "Naan")
        self.assertFalse(res1.is_final)
        self.assertEqual(res1.stable_word_count, 0)
        self.assertEqual(res1.tentative_word_count, 1)

        # Update 2: "Naan meeting" ("Naan" seen twice -> committed)
        res2 = engine.process_partial("Naan meeting")
        self.assertEqual(res2.newly_committed_text, "Naan")
        self.assertEqual(res2.cumulative_committed_text, "Naan")
        self.assertEqual(res2.tentative_text, "meeting")
        self.assertEqual(res2.full_transcript, "Naan meeting")
        self.assertEqual(res2.stable_word_count, 1)
        self.assertEqual(res2.tentative_word_count, 1)

        # Update 3: "Naan meeting-ku" ("meeting" revised to "meeting-ku" -> reset streak for token 2)
        res3 = engine.process_partial("Naan meeting-ku")
        self.assertEqual(res3.newly_committed_text, "")
        self.assertEqual(res3.cumulative_committed_text, "Naan")
        self.assertEqual(res3.tentative_text, "meeting-ku")
        self.assertEqual(res3.full_transcript, "Naan meeting-ku")
        self.assertEqual(res3.stable_word_count, 1)
        self.assertEqual(res3.tentative_word_count, 1)

        # Update 4: "Naan meeting-ku late" ("meeting-ku" seen twice -> committed)
        res4 = engine.process_partial("Naan meeting-ku late")
        self.assertEqual(res4.newly_committed_text, "meeting-ku")
        self.assertEqual(res4.cumulative_committed_text, "Naan meeting-ku")
        self.assertEqual(res4.tentative_text, "late")
        self.assertEqual(res4.full_transcript, "Naan meeting-ku late")
        self.assertEqual(res4.stable_word_count, 2)
        self.assertEqual(res4.tentative_word_count, 1)

        # Update 5: "Naan meeting-ku late aagiten" ("late" seen twice -> committed)
        res5 = engine.process_partial("Naan meeting-ku late aagiten")
        self.assertEqual(res5.newly_committed_text, "late")
        self.assertEqual(res5.cumulative_committed_text, "Naan meeting-ku late")
        self.assertEqual(res5.tentative_text, "aagiten")
        self.assertEqual(res5.full_transcript, "Naan meeting-ku late aagiten")
        self.assertEqual(res5.stable_word_count, 3)
        self.assertEqual(res5.tentative_word_count, 1)

        # Final Update (stream complete): all remaining tentative text is committed
        res_final = engine.process_partial("Naan meeting-ku late aagiten", is_final=True)
        self.assertEqual(res_final.newly_committed_text, "aagiten")
        self.assertEqual(res_final.cumulative_committed_text, "Naan meeting-ku late aagiten")
        self.assertEqual(res_final.tentative_text, "")
        self.assertEqual(res_final.full_transcript, "Naan meeting-ku late aagiten")
        self.assertTrue(res_final.is_final)
        self.assertEqual(res_final.stable_word_count, 4)
        self.assertEqual(res_final.tentative_word_count, 0)


class TestStabilityConfig(unittest.TestCase):
    """
    Test suite for engine stability threshold configurations.
    """

    def test_immediate_commit_threshold_1(self):
        engine = StabilityEngine(StabilityConfig(min_stability_count=1))
        res1 = engine.process_partial("Hello")
        self.assertEqual(res1.newly_committed_text, "Hello")
        self.assertEqual(res1.cumulative_committed_text, "Hello")
        self.assertEqual(res1.tentative_text, "")

        res2 = engine.process_partial("Hello world")
        self.assertEqual(res2.newly_committed_text, "world")
        self.assertEqual(res2.cumulative_committed_text, "Hello world")
        self.assertEqual(res2.tentative_text, "")

    def test_higher_threshold_3(self):
        engine = StabilityEngine(StabilityConfig(min_stability_count=3))
        res1 = engine.process_partial("Indic AI")
        self.assertEqual(res1.cumulative_committed_text, "")
        
        res2 = engine.process_partial("Indic AI")
        self.assertEqual(res2.cumulative_committed_text, "")

        res3 = engine.process_partial("Indic AI project")
        self.assertEqual(res3.newly_committed_text, "Indic AI")
        self.assertEqual(res3.cumulative_committed_text, "Indic AI")
        self.assertEqual(res3.tentative_text, "project")

    def test_invalid_config_raises_value_error(self):
        with self.assertRaises(ValueError):
            StabilityConfig(min_stability_count=0)
        with self.assertRaises(ValueError):
            StabilityConfig(max_uncommitted_buffer=0)


class TestEngineStateAndReset(unittest.TestCase):
    """
    Test suite for engine reset and session lifecycle management.
    """

    def test_reset(self):
        engine = StabilityEngine(StabilityConfig(min_stability_count=2))
        engine.process_partial("Testing stability")
        engine.process_partial("Testing stability engine")

        self.assertNotEqual(engine.committed_text, "")
        engine.reset()
        self.assertEqual(engine.committed_text, "")

        res = engine.process_partial("New session")
        self.assertEqual(res.cumulative_committed_text, "")
        self.assertEqual(res.tentative_text, "New session")


class TestEdgeCasesAndSerialization(unittest.TestCase):
    """
    Test suite for edge cases such as empty input, punctuation, and serialization.
    """

    def test_empty_input(self):
        engine = StabilityEngine()
        res = engine.process_partial("")
        self.assertEqual(res.newly_committed_text, "")
        self.assertEqual(res.cumulative_committed_text, "")
        self.assertEqual(res.tentative_text, "")

        res_space = engine.process_partial("   ")
        self.assertEqual(res_space.tentative_text, "")

    def test_serialization_to_dict(self):
        engine = StabilityEngine(StabilityConfig(min_stability_count=1))
        res = engine.process_partial("Sample stream", is_final=True)
        res_dict = res.to_dict()

        self.assertIsInstance(res_dict, dict)
        self.assertEqual(res_dict["newly_committed_text"], "Sample stream")
        self.assertEqual(res_dict["cumulative_committed_text"], "Sample stream")
        self.assertEqual(res_dict["tentative_text"], "")
        self.assertTrue(res_dict["is_final"])
        self.assertEqual(res_dict["stable_word_count"], 2)
        self.assertEqual(res_dict["tentative_word_count"], 0)


if __name__ == "__main__":
    unittest.main()
