"""Integration module for Indic Live Translator AI pipeline."""

from ai.integration.asr_adapter import SaarasASRAdapter, extract_transcript_text, normalize_asr_result
from ai.integration.translation_pipeline import (
    ASRTranslationPipeline,
    TranslationPipeline,
    translate_asr_event,
)
from ai.integration.stability_adapter import (
    TranslationStabilityAdapter,
    StabilityAdapter,
    StabilityAdapterError,
    StabilityEngineProtocol,
    adapt_translation_to_stability,
    stabilize_translation_event,
)

__all__ = [
    # Stage 3 – ASR normalization
    "SaarasASRAdapter",
    "extract_transcript_text",
    "normalize_asr_result",
    # Stage 4 – Translation
    "ASRTranslationPipeline",
    "TranslationPipeline",
    "translate_asr_event",
    # Stage 5 – Stability adapter
    "TranslationStabilityAdapter",
    "StabilityAdapter",
    "StabilityAdapterError",
    "StabilityEngineProtocol",
    "adapt_translation_to_stability",
    "stabilize_translation_event",
]

