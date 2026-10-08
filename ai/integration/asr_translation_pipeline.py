"""Alias module forwarding to translation_pipeline."""

from ai.integration.translation_pipeline import (
    ASRTranslationPipeline,
    TranslationPipeline,
    translate_asr_event,
)

__all__ = [
    "ASRTranslationPipeline",
    "TranslationPipeline",
    "translate_asr_event",
]
