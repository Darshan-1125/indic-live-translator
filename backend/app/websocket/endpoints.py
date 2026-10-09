import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.websocket.connection_manager import manager

logger = logging.getLogger("app.websocket.endpoints")
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/session/{session_id}")
async def session_websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time session communication.
    
    Accepts connection, receives JSON messages, logs them, returns JSON ack,
    and gracefully handles disconnections.
    """
    await manager.connect(session_id, websocket)
    try:
        while True:
            # Receive incoming message (supports JSON text or parsed dict)
            raw_data = await websocket.receive_text()
            
            try:
                message_json = json.loads(raw_data)
            except json.JSONDecodeError:
                message_json = {"raw_text": raw_data}

            # Log received message
            logger.info(f"[{session_id}] WebSocket received message: {message_json}")

            # Send back simple JSON acknowledgement
            await manager.send_json_ack(websocket, message_json)

    except WebSocketDisconnect:
        logger.info(f"[{session_id}] Client disconnected gracefully.")
        manager.disconnect(session_id, websocket)
    except Exception as e:
        logger.error(f"[{session_id}] WebSocket encountered error: {e}", exc_info=True)
        manager.disconnect(session_id, websocket)
