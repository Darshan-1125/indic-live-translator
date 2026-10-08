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
├── README.md              # AI module documentation and architecture guide
├── requirements.txt       # Dependencies for AI services
├── services/
│   ├── __init__.py        # Public service exports
│   ├── saras.py           # Sarvam Saaras Speech-to-Text service abstraction
│   ├── translation.py     # Sarvam Mayura Translation service abstraction
│   └── tts.py             # Sarvam Bulbul Text-to-Speech service abstraction
└── tests/
    └── test_services.py   # Unit tests for AI service abstractions
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

## Integration Roadmap (Future Milestones)

- [ ] **Streaming STT**: Connect Saaras WebSocket streaming (`wss://api.sarvam.ai/speech-to-text-websocket`) for ultra-low latency real-time audio chunking.
- [ ] **Keyterm Prompting**: Inject domain-specific terminology into Saaras to boost accuracy on technical jargon.
- [ ] **FastAPI Endpoints**: Wire up service abstractions to REST/WebSocket routes in `backend/`.
- [ ] **LiveKit Audio Piping**: Stream audio chunks directly from LiveKit WebRTC tracks into the pipeline.
- [ ] **Stability Engine Hook**: Pass partial transcripts through the stability engine before final translation and synthesis.
