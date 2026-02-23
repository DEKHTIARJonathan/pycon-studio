import json
import asyncio
import math
from typing import Any
from fastapi import WebSocket
from loguru import logger


class ConnectionManager:
    """Manages WebSocket connections for real-time generation progress."""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self._connections)}")

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self._connections)}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        # Replace NaN/Inf floats with None (JSON spec doesn't support them)
        sanitized = {
            k: (None if isinstance(v, float) and not math.isfinite(v) else v)
            for k, v in message.items()
        }
        data = json.dumps(sanitized)
        disconnected: list[WebSocket] = []
        async with self._lock:
            connections = list(self._connections)

        for ws in connections:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.append(ws)

        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    if ws in self._connections:
                        self._connections.remove(ws)

    async def send_to(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception:
            await self.disconnect(websocket)


generation_ws_manager = ConnectionManager()
health_ws_manager = ConnectionManager()
