import asyncio
import json
import websockets


async def test_websocket():
    uri = "ws://127.0.0.1:8000/ws/session/test-room"

    async with websockets.connect(uri) as websocket:
        print("Connected to WebSocket!")

        message = {
            "type": "ping",
            "message": "Hello backend"
        }

        await websocket.send(json.dumps(message))
        print("Sent:", message)

        response = await websocket.recv()
        print("Received:", response)


asyncio.run(test_websocket())