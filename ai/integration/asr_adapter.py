"""ASR integration adapter for normalizing Saaras ASR results into backend events.

Converts Saaras speech-to-text outputs into the backend team's expected event structure:
{
  "type": "asr_partial",
  "session_id": "<session_id>",
  "speaker_id": "<speaker_id>",
  "text": "<recognized text>",
  "is_final": true/false
}
"""

from __future__ import annotations

from typing import Any, Dict


def extract_transcript_text(response: Any) -> str:
    """Extract recognized transcript text from various Saaras response structures."""
    if response is None:
        return ""
    if isinstance(response, str):
        return response.strip()

    # Sarvam SDK SpeechToTextResponse or custom object with 'transcript'
    if hasattr(response, "transcript"):
        val = getattr(response, "transcript")
        return str(val).strip() if val is not None else ""

    if hasattr(response, "text"):
        val = getattr(response, "text")
        return str(val).strip() if val is not None else ""

    # Dictionary outputs from Saaras service or WebSocket
    if isinstance(response, dict):
        if "transcript" in response and response["transcript"] is not None:
            return str(response["transcript"]).strip()
        if "text" in response and response["text"] is not None:
            return str(response["text"]).strip()
        if "data" in response and isinstance(response["data"], dict):
            data_map = response["data"]
            if "transcript" in data_map and data_map["transcript"] is not None:
                return str(data_map["transcript"]).strip()
            if "text" in data_map and data_map["text"] is not None:
                return str(data_map["text"]).strip()

    return str(response).strip()


def normalize_asr_result(
    response: Any,
    session_id: str,
    speaker_id: str,
    is_final: bool = False,
) -> Dict[str, Any]:
    """Normalize a Saaras ASR output into the exact backend event structure.

    Args:
        response: Output from Saaras STT (SpeechToTextResponse, dict, or string).
        session_id: Caller-supplied session identifier.
        speaker_id: Caller-supplied speaker identifier.
        is_final: Flag indicating whether this is a final or intermediate partial result.

    Returns:
        Exact dictionary required by backend:
        {
            "type": "asr_partial",
            "session_id": "<session_id>",
            "speaker_id": "<speaker_id>",
            "text": "<recognized text>",
            "is_final": true/false
        }

    Raises:
        ValueError: If session_id or speaker_id are missing or empty.
    """
    if not session_id or not str(session_id).strip():
        raise ValueError("session_id must be supplied by the caller and cannot be empty.")
    if not speaker_id or not str(speaker_id).strip():
        raise ValueError("speaker_id must be supplied by the caller and cannot be empty.")

    text = extract_transcript_text(response)

    return {
        "type": "asr_partial",
        "session_id": str(session_id).strip(),
        "speaker_id": str(speaker_id).strip(),
        "text": text,
        "is_final": bool(is_final),
    }


class SaarasASRAdapter:
    """Simple adapter class for normalizing Saaras ASR results."""

    def __init__(self, session_id: str = "", speaker_id: str = "") -> None:
        self.session_id = session_id
        self.speaker_id = speaker_id

    def normalize(
        self,
        response: Any,
        session_id: str = "",
        speaker_id: str = "",
        is_final: bool = False,
    ) -> Dict[str, Any]:
        """Normalize Saaras ASR result into the exact backend event structure."""
        active_session = session_id or self.session_id
        active_speaker = speaker_id or self.speaker_id
        return normalize_asr_result(
            response=response,
            session_id=active_session,
            speaker_id=active_speaker,
            is_final=is_final,
        )
