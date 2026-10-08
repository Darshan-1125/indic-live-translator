# AI Pipeline Module - Indic Live Translator

This module implements the core AI pipeline services for the Indic Live Translator hackathon project. It provides isolated, modular abstractions for Speech-to-Text (STT), Machine Translation, and Text-to-Speech (TTS) using Sarvam AI's Indic models.

---

## Pipeline Flow

The AI pipeline is designed to process live audio through sequential transformation stages:

```
┌─────────┐      ┌───────────────┐      ┌────────────┐      ┌─────────────┐      ┌─────────────────┐      ┌───────────────┐      ┌─────────┐
│  audio  │ ───> │ Sarvam Saaras │ ───> │ transcript │ ───> │ Translation │ ───> │ translated text │ ───> │ Sarvam Bulbul │ ───> │ speech  │
│ (Input) │      │  (STT: v4)    │      │            │      │  (Mayura)   │      │                 │      │  (TTS: v3)    │      │(Output) │
└─────────┘      └───────────────┘      └────────────┘      └─────────────┘      └─────────────────┘      └───────────────┘      └─────────┘
```

1. **Audio Input**: Live or buffered audio stream in WAV/MP3 format.
2. **Saaras STT**: Transcribes input speech into text using Sarvam's `saaras:v4` model. Supports Tamil (`ta-IN`), English (`en-IN`), and code-mixed speech (`codemix` output mode).
3. **Transcript**: Raw textual representation of the recognized speech.
4. **Sarvam Translation (Mayura)**: Translates the transcript between Tamil and English (`ta-IN` ↔ `en-IN`), handling colloquial and code-mixed inputs.
5. **Translated Text**: Clean target-language text output.
6. **Bulbul TTS**: Synthesizes the translated text into natural Indic speech using Sarvam's `bulbul:v3` multilingual model.
7. **Speech Output**: Synthesized audio bytes returned for playback or WebRTC streaming.

---

## Supported Languages & Code-Mixing

- **Tamil (`ta-IN`)**: Full transcription, translation, and natural voice synthesis.
- **English (`en-IN`)**: Indian English transcription, bidirectional translation, and voice synthesis.
- **Tamil-English Code-Mixed Speech ("Tanglish")**: Handled via Saaras code-mix transcription (`output_mode="codemix"`) and Mayura translation context.

---

## Module Isolation

This module is strictly decoupled from:
- `frontend/`: UI, React/Next.js components, and browser WebRTC audio handling.
- `backend/`: FastAPI server routes, session orchestration, and database persistence.
- `stability-engine/`: Chunk smoothing, jitter buffering, and translation stability algorithms.

By keeping the AI layer purely service-oriented, the pipeline can be tested, benchmarked, and upgraded independently without introducing cross-module coupling.

---

## Directory Structure

```
ai/
├── README.md                   # AI module documentation and architecture guide
├── requirements.txt            # Dependencies for AI services
├── integration/
│   ├── __init__.py             # Public integration exports
│   ├── asr_adapter.py          # Saaras ASR output normalization adapter
│   ├── stability_adapter.py    # Stage 5: Translation to Stability Engine adapter
│   └── translation_pipeline.py # Stage 4: ASR to Translation pipeline
├── services/
│   ├── __init__.py             # Public service exports
│   ├── saras.py                # Sarvam Saaras Speech-to-Text service abstraction (REST)
│   ├── saras_streaming.py      # Sarvam Saaras Speech-to-Text v4 streaming ASR adapter (WebSocket)
│   ├── translation.py          # Sarvam Mayura Translation service abstraction
│   └── tts.py                  # Sarvam Bulbul Text-to-Speech service abstraction
└── tests/
    ├── __init__.py
    ├── test_asr_adapter.py     # Unit tests for ASR normalization adapter
    ├── test_saras_streaming.py # Unit tests for Saaras v4 streaming ASR adapter
    ├── test_services.py        # Unit tests for AI service abstractions
    ├── test_stability_adapter.py # Unit tests for Stability adapter
    └── test_translation_pipeline.py # Unit tests for ASR to Translation pipeline
```

---

## Setup & Configuration

### 1. Install Dependencies

```bash
pip install -r ai/requirements.txt
```

### 2. Environment Variables

All services read API credentials from the environment. **Never hardcode API keys.**

Create a `.env` file or export the key:

```bash
export SARVAM_API_KEY="your-sarvam-subscription-key"
```

Optional overrides:
- `SARVAM_BASE_URL`: defaults to `https://api.sarvam.ai`

---

## Usage Examples

### 1. Speech-to-Text (Saaras)

```python
from ai.services.saras import SaarasSpeechToTextService

stt = SaarasSpeechToTextService()

# Transcribe Tamil or Code-mixed audio
result = stt.transcribe(
    audio="sample.wav",
    language_code="ta-IN",
    output_mode="codemix",  # Supports 'transcribe', 'translate', 'codemix'
)
print("Transcript:", result["transcript"])
```

### 2. Translation (Mayura)

```python
from ai.services.translation import SarvamTranslationService

translator = SarvamTranslationService()

# Translate Tamil to English
result = translator.translate(
    text="வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?",
    source_language_code="ta-IN",
    target_language_code="en-IN",
)
print("Translated:", result["translated_text"])
```

### 3. Text-to-Speech (Bulbul)

```python
from ai.services.tts import BulbulTTSService

tts = BulbulTTSService()

# Synthesize speech in Tamil or English
result = tts.synthesize(
    text="Hello, welcome to Indic Live Translator.",
    language_code="en-IN",
    speaker="shubh",
    output_audio_codec="wav",
)

with open("output.wav", "wb") as f:
    f.write(result["audio_bytes"])
```

### 4. ASR → Translation Pipeline (Stage 4)

```python
from ai.integration import ASRTranslationPipeline

pipeline = ASRTranslationPipeline()

# Translate a normalized ASR event (handles Tamil and Tanglish code-mixed text)
event = {
    "type": "asr_partial",
    "session_id": "session-123",
    "speaker_id": "user-a",
    "text": "Naan meeting-ku late aagiten",
    "is_final": False,
}

result = pipeline.process(event)
print(result)
# {
#   "type": "translation",
#   "session_id": "session-123",
#   "speaker_id": "user-a",
#   "text": "Naan meeting-ku late aagiten",
#   "translated_text": "I got late to the meeting",
#   "is_final": False
# }
### 5. Real-Time Streaming ASR (Saaras v4 WebSocket)

Real-time streaming speech recognition uses Sarvam's official SDK WebSocket method (`AsyncSarvamAI.speech_to_text_streaming.connect`), supporting Tamil and Tamil-English code-mixed speech ("Tanglish").

#### Normalized ASR Event Contract

Every recognized partial or final transcript chunk is normalized into:

```json
{
  "type": "asr_partial",
  "session_id": "session-123",
  "speaker_id": "speaker-456",
  "text": "Naan meeting-ku late aagiten",
  "is_final": false,
  "language_code": "ta-IN",
  "is_code_mixed": true
}
```

- **Mandatory fields**: `type`, `session_id`, `speaker_id`, `text`, `is_final`
- **Optional fields**: `language_code` (BCP-47 string, included when provided by SDK response), `is_code_mixed` (boolean, `true` when in `codemix` mode)

#### Backend Consumption Example

The backend handles WebSocket transport, receives audio chunks, and consumes the async stream:

```python
from ai.services.saras_streaming import SaarasStreamingASR
from app.services.stability import StabilityAdapter

async def process_incoming_audio_stream(
    audio_chunk_stream,  # AsyncIterator[bytes] (raw WAV/PCM chunks)
    session_id: str,
    speaker_id: str,
):
    streamer = SaarasStreamingASR(
        session_id=session_id,
        speaker_id=speaker_id,
        language_code="ta-IN",
        mode="codemix",  # Supports Tamil and Tanglish code-mixed speech
    )
    stability = StabilityAdapter()

    async for asr_event in streamer.stream(audio_chunk_stream, is_final_chunk=True):
        # asr_event is guaranteed to follow the normalized ASR contract:
        asr_text = asr_event["text"]
        is_final = asr_event["is_final"]

        # Backend StabilityAdapter processes partial or final ASR text
        stability_result = stability.process_asr_result(
            asr_text,
            is_final=is_final,
        )

        # Broadcast stabilized result to frontend via WebSocket
        await broadcast_to_session(session_id, stability_result)
```

---

## Testing

Run unit tests:

```bash
pytest ai/tests/test_services.py
```

Or using Python's built-in test runner:

```bash
python3 -m unittest discover -s ai/tests
```

All unit tests mock external network calls to ensure fast, deterministic, and isolated execution without consuming API credits.

---

## Integration Roadmap

- [x] **Streaming STT**: Sarvam Saaras v4 WebSocket streaming (`AsyncSarvamAI.speech_to_text_streaming.connect`) with normalization and Tanglish code-mix support.
- [x] **Stage 4 Pipeline**: ASR event normalization to Sarvam Mayura Translation.
- [x] **Stage 5 Adapter**: Translation events to backend Stability Engine adapter.
- [ ] **Keyterm Prompting**: Inject domain-specific terminology into Saaras to boost accuracy on technical jargon.
- [ ] **FastAPI Endpoints**: Wire up service abstractions to REST/WebSocket routes in `backend/`.
- [ ] **LiveKit Audio Piping**: Stream audio chunks directly from LiveKit WebRTC tracks into the pipeline.
