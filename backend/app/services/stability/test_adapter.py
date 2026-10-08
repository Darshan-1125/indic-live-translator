import unittest
from backend.app.services.stability.adapter import StabilityAdapter
from backend.app.services.stability.config import StabilityConfig
from backend.app.services.stability.models import StabilityResult


class TestStabilityAdapter(unittest.TestCase):
    """
    Unit tests for the StabilityAdapter integration layer.
    """

    def test_process_asr_result_partial_and_committed(self):
        adapter = StabilityAdapter(StabilityConfig(min_stability_count=2))

        # First partial update -> tentative text returned
        res1 = adapter.process_asr_result("Hello", is_final=False)
        self.assertIsInstance(res1, StabilityResult)
        self.assertEqual(res1.tentative_text, "Hello")
        self.assertEqual(res1.cumulative_committed_text, "")
        self.assertEqual(res1.newly_committed_text, "")

        # Second partial update -> "Hello" is confirmed stable and committed
        res2 = adapter.process_asr_result("Hello world", is_final=False)
        self.assertEqual(res2.cumulative_committed_text, "Hello")
        self.assertEqual(res2.newly_committed_text, "Hello")
        self.assertEqual(res2.tentative_text, "world")

    def test_adapter_is_final(self):
        adapter = StabilityAdapter(StabilityConfig(min_stability_count=2))
        adapter.process_asr_result("Testing final stream", is_final=False)
        
        res_final = adapter.process_asr_result("Testing final stream payload", is_final=True)
        self.assertTrue(res_final.is_final)
        self.assertEqual(res_final.tentative_text, "")
        self.assertIn("payload", res_final.cumulative_committed_text)

    def test_adapter_reset(self):
        adapter = StabilityAdapter()
        adapter.process_asr_result("Stream text 1")
        adapter.process_asr_result("Stream text 1 2")
        
        adapter.reset()
        res_fresh = adapter.process_asr_result("Fresh session")
        self.assertEqual(res_fresh.cumulative_committed_text, "")
        self.assertEqual(res_fresh.tentative_text, "Fresh session")


if __name__ == "__main__":
    unittest.main()
