import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger("app.websocket.manager")


class ConnectionManager:
    """Manages active WebSocket connections per session ID."""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        """Accept connection and register websocket under session_id."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        logger.info(
            f"Client connected to session '{session_id}'. "
            f"Active connections in session: {len(self.active_connections[session_id])}"
        )

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        """Remove websocket from session_id connections cleanly."""
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
                logger.info(
                    f"Client disconnected from session '{session_id}'. "
                    f"Remaining connections: {len(self.active_connections[session_id])}"
                )
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                logger.info(f"Session '{session_id}' cleaned up (no remaining clients).")

    async def send_json_ack(self, websocket: WebSocket, original_data: dict) -> None:
        """Send a simple JSON acknowledgement back to the client."""
        ack_payload = {
            "type": "ack",
            "status": "received",
            "received_data": original_data
        }
        await websocket.send_json(ack_payload)


manager = ConnectionManager()
