import asyncio
import base64
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.speech_pipeline import RealtimeSpeechPipeline
from app.websocket.connection_manager import manager

logger = logging.getLogger("app.websocket.translate")

router = APIRouter(tags=["Translation WebSocket"])


@router.websocket("/ws/translate")
async def websocket_translate_endpoint(websocket: WebSocket):
    """Real-time Speech Translation WebSocket Endpoint.

    Protocol:
      1. START:
         { "type": "start", "session_id": "...", "speaker_id": "..." }
         -> Receives: { "type": "started", "session_id": "...", "speaker_id": "..." }

      2. AUDIO:
         { "type": "audio", "audio": "<base64-encoded 16-bit PCM 16kHz mono>" }
         -> Asynchronously processed, receives translation and caption events:
            {
              "type": "translation",
              "session_id": "...",
              "speaker_id": "...",
              "text": "...",
              "translated_text": "...",
              "is_final": false
            }

      3. STOP:
         { "type": "stop" }
         -> Finalizes stream, receives:
            { "type": "stopped", "session_id": "..." }
    """
    await websocket.accept()

    session_id: Optional[str] = None
    speaker_id: Optional[str] = None
    pipeline: Optional[RealtimeSpeechPipeline] = None
    worker_task: Optional[asyncio.Task] = None

    async def send_translation_event(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception as exc:
            logger.debug(f"Failed to send translation event over websocket: {exc}")

    async def send_caption_event(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception as exc:
            logger.debug(f"Failed to send caption event over websocket: {exc}")

    try:
        while True:
            raw_text = await websocket.receive_text()

            # 1. Parse JSON
            try:
                message = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format",
                })
                continue

            if not isinstance(message, dict):
                await websocket.send_json({
                    "type": "error",
                    "message": "Message payload must be a JSON object",
                })
                continue

            msg_type = message.get("type")
            if not msg_type:
                await websocket.send_json({
                    "type": "error",
                    "message": "Missing 'type' field in message",
                })
                continue

            # 2. START Handler
            if msg_type == "start":
                if session_id is not None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Session already started",
                    })
                    continue

                raw_session_id = message.get("session_id")
                raw_speaker_id = message.get("speaker_id")

                if not raw_session_id or not isinstance(raw_session_id, str) or not raw_session_id.strip():
                    await websocket.send_json({
                        "type": "error",
                        "message": "Valid 'session_id' is required",
                    })
                    continue

                if not raw_speaker_id or not isinstance(raw_speaker_id, str) or not raw_speaker_id.strip():
                    await websocket.send_json({
                        "type": "error",
                        "message": "Valid 'speaker_id' is required",
                    })
                    continue

                session_id = raw_session_id.strip()
                speaker_id = raw_speaker_id.strip()
                source_lang = message.get("source_language_code", "ta-IN")
                target_lang = message.get("target_language_code", "en-IN")

                # Register in connection manager
                if session_id not in manager.active_connections:
                    manager.active_connections[session_id] = []
                manager.active_connections[session_id].append(websocket)

                try:
                    pipeline = RealtimeSpeechPipeline(
                        session_id=session_id,
                        speaker_id=speaker_id,
                        source_language_code=source_lang,
                        target_language_code=target_lang,
                        on_translation=send_translation_event,
                        on_caption=send_caption_event,
                    )
                    worker_task = asyncio.create_task(pipeline.run())
                except Exception as exc:
                    logger.exception("Failed to initialize speech pipeline: %s", exc)
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Failed to initialize speech pipeline: {exc}",
                    })
                    session_id = None
                    speaker_id = None
                    continue

                await websocket.send_json({
                    "type": "started",
                    "session_id": session_id,
                    "speaker_id": speaker_id,
                })
                logger.info(
                    "Session started: session_id=%s, speaker_id=%s",
                    session_id,
                    speaker_id,
                )

            # 3. AUDIO Handler
            elif msg_type == "audio":
                if session_id is None or pipeline is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "AUDIO received before START",
                    })
                    continue

                b64_audio = message.get("audio")
                if not b64_audio or not isinstance(b64_audio, str):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid or missing 'audio' field in message",
                    })
                    continue

                try:
                    audio_bytes = base64.b64decode(b64_audio, validate=True)
                except Exception:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Failed to decode base64 audio",
                    })
                    continue

                if not audio_bytes:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Audio payload is empty",
                    })
                    continue

                # Enqueue audio non-blockingly
                await pipeline.push_audio(audio_bytes)

            # 4. STOP Handler
            elif msg_type == "stop":
                if session_id is None or pipeline is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": "STOP received before START",
                    })
                    continue

                stopped_session_id = session_id
                await pipeline.finish()

                if worker_task:
                    try:
                        await asyncio.wait_for(worker_task, timeout=5.0)
                    except asyncio.TimeoutError:
                        logger.warning("Pipeline finish timed out, cancelling worker task.")
                        worker_task.cancel()
                    except Exception as exc:
                        logger.error("Error awaiting pipeline completion: %s", exc)
                    worker_task = None

                await websocket.send_json({
                    "type": "stopped",
                    "session_id": stopped_session_id,
                })
                logger.info("Session stopped: session_id=%s", stopped_session_id)

                # Reset state so client can optionally start another session
                if stopped_session_id in manager.active_connections:
                    if websocket in manager.active_connections[stopped_session_id]:
                        manager.active_connections[stopped_session_id].remove(websocket)
                    if not manager.active_connections[stopped_session_id]:
                        del manager.active_connections[stopped_session_id]

                session_id = None
                speaker_id = None
                pipeline = None

            # 5. Unknown message type
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type '{msg_type}'",
                })

    except WebSocketDisconnect:
        logger.info("Client disconnected: session_id=%s", session_id)
    except Exception as exc:
        logger.error("WebSocket unhandled exception: %s", exc, exc_info=True)
    finally:
        if worker_task and not worker_task.done():
            worker_task.cancel()
            try:
                await worker_task
            except (asyncio.CancelledError, Exception):
                pass

        if session_id and session_id in manager.active_connections:
            if websocket in manager.active_connections[session_id]:
                manager.active_connections[session_id].remove(websocket)
            if not manager.active_connections[session_id]:
                del manager.active_connections[session_id]
