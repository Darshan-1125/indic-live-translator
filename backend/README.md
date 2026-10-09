# Indic Live Translator — Backend Documentation

## 1. Quickstart & Startup

### Environment Setup
Create `backend/.env` (copy from `.env.example`):
```env
APP_NAME="Indic Live Translator Backend"
DEBUG=True
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://127.0.0.1:3000","http://127.0.0.1:5173"]
HOST=0.0.0.0
PORT=8000

# LiveKit credentials (for LiveKit room flow)
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
LIVEKIT_URL=wss://your-livekit-url

# Sarvam credentials (for Saaras v4 STT & Mayura translation)
SARVAM_API_KEY=your_sarvam_api_key
```

### Starting the Server
From the `backend` directory in PowerShell:
```powershell
$env:PYTHONPATH = (Resolve-Path ..).Path
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 2. HTTP Endpoints

### Health Check
- **Endpoint**: `GET /health`
- **URL**: `http://<LAN_IP>:8000/health` (e.g. `http://10.8.3.8:8000/health` or `http://localhost:8000/health`)
- **Response**:
```json
{
  "status": "ok"
}
```

### LiveKit Token Generation
- **Endpoint**: `POST /api/livekit/token`
- **Body**:
```json
{
  "room_name": "indic-room-1",
  "participant_name": "user-A"
}
```
- **Response**:
```json
{
  "token": "<JWT_TOKEN>",
  "url": "wss://..."
}
```

---

## 3. Real-Time Translation WebSocket (`/ws/translate`)

- **WebSocket URL**: `ws://<LAN_IP>:8000/ws/translate` (e.g. `ws://10.8.3.8:8000/ws/translate` or `ws://127.0.0.1:8000/ws/translate`)

### Message Protocol

#### 1. START
Sent by frontend to initialize session and pipeline.
```json
{
  "type": "start",
  "session_id": "room-101",
  "speaker_id": "user-A",
  "source_language_code": "ta-IN",
  "target_language_code": "en-IN"
}
```
*(Note: `source_language_code` and `target_language_code` are optional and default to `ta-IN` and `en-IN`)*

**Server Response (ACK):**
```json
{
  "type": "started",
  "session_id": "room-101",
  "speaker_id": "user-A"
}
```

#### 2. AUDIO
Sent by frontend continuously as audio frames are captured.
- **Format**: 16-bit PCM, 16kHz, mono, little-endian, base64 encoded.
```json
{
  "type": "audio",
  "audio": "<base64_encoded_pcm16_bytes>"
}
```

**Server Asynchronous Output 1 — Caption (ASR + Stability Engine):**
```json
{
  "type": "caption",
  "session_id": "room-101",
  "speaker_id": "user-A",
  "text": "வணக்கம் எப்படி இருக்கிறீர்கள்",
  "committed_text": "வணக்கம் எப்படி",
  "tentative_text": "இருக்கிறீர்கள்",
  "is_final": false
}
```

**Server Asynchronous Output 2 — Translation (Mayura Translation):**
```json
{
  "type": "translation",
  "session_id": "room-101",
  "speaker_id": "user-A",
  "text": "வணக்கம் எப்படி இருக்கிறீர்கள்",
  "translated_text": "Hello, how are you?",
  "committed_text": "வணக்கம் எப்படி",
  "tentative_text": "இருக்கிறீர்கள்",
  "is_final": false
}
```

#### 3. STOP
Sent by frontend when the user stops speaking / mutes.
```json
{
  "type": "stop"
}
```

**Server Response:**
```json
{
  "type": "stopped",
  "session_id": "room-101"
}
```

#### 4. Error Message (if any validation fails):
```json
{
  "type": "error",
  "message": "AUDIO received before START"
}
```

---

## 4. Testing & Verification

Run all unit and integration tests from `backend`:
```powershell
$env:PYTHONPATH = (Resolve-Path ..).Path
.\.venv\Scripts\python.exe -m pytest tests/ -q
```
