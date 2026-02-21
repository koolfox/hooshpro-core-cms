from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.config import settings
from app.db import SessionLocal
from app.models import User, UserSession
from app.security import hash_session_token

router = APIRouter(tags=["ws"])

_ALLOWED_RESOURCE_TYPES = {"pages", "templates", "blocks", "components"}
_MAX_MESSAGE_BYTES = 128_000


class _RoomHub:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, WebSocket]] = {}
        self._clients: dict[str, tuple[int, str]] = {}
        self._lock = asyncio.Lock()

    async def join(self, room: str, client_id: str, ws: WebSocket, *, user_id: int, email: str) -> None:
        async with self._lock:
            room_clients = self._rooms.setdefault(room, {})
            room_clients[client_id] = ws
            self._clients[client_id] = (user_id, email)

    async def leave(self, room: str, client_id: str) -> None:
        async with self._lock:
            room_clients = self._rooms.get(room)
            if room_clients is not None:
                room_clients.pop(client_id, None)
                if not room_clients:
                    self._rooms.pop(room, None)
            self._clients.pop(client_id, None)

    async def participants(self, room: str) -> list[dict[str, Any]]:
        async with self._lock:
            room_clients = self._rooms.get(room, {})
            out: list[dict[str, Any]] = []
            for cid in room_clients:
                info = self._clients.get(cid)
                if not info:
                    continue
                out.append({"client_id": cid, "user_id": info[0], "email": info[1]})
            return out

    async def broadcast(self, room: str, payload: dict[str, Any], *, exclude: str | None = None) -> None:
        async with self._lock:
            room_clients = list((self._rooms.get(room) or {}).items())

        stale: list[str] = []
        for cid, ws in room_clients:
            if exclude is not None and cid == exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(cid)

        if stale:
            async with self._lock:
                current = self._rooms.get(room)
                if current is None:
                    return
                for cid in stale:
                    current.pop(cid, None)
                    self._clients.pop(cid, None)
                if not current:
                    self._rooms.pop(room, None)


hub = _RoomHub()


def _candidate_tokens(ws: WebSocket) -> list[str]:
    tokens: list[str] = []

    auth_header = ws.headers.get("authorization")
    if isinstance(auth_header, str):
        parts = auth_header.strip().split(" ", maxsplit=1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
            tokens.append(parts[1].strip())

    query_token = ws.query_params.get("token")
    if isinstance(query_token, str) and query_token.strip():
        tokens.append(query_token.strip())

    cookie_token = ws.cookies.get(settings.COOKIE_NAME)
    if isinstance(cookie_token, str) and cookie_token.strip():
        tokens.append(cookie_token.strip())

    # Preserve order but remove duplicates.
    unique: list[str] = []
    for token in tokens:
        if token not in unique:
            unique.append(token)
    return unique


def _authenticate_ws(ws: WebSocket) -> User | None:
    tokens = _candidate_tokens(ws)
    if not tokens:
        return None

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        for raw in tokens:
            token_hash = hash_session_token(raw)
            sess = (
                db.query(UserSession)
                .filter(UserSession.token_hash == token_hash, UserSession.expires_at > now)
                .first()
            )
            if not sess:
                continue
            user = db.query(User).filter(User.id == sess.user_id).first()
            if user:
                return user
    return None


@router.websocket("/api/ws/editor/{resource_type}/{resource_id}")
async def ws_editor_room(websocket: WebSocket, resource_type: str, resource_id: int) -> None:
    normalized = resource_type.strip().lower()
    if normalized not in _ALLOWED_RESOURCE_TYPES:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unsupported_resource")
        return

    user = _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="unauthorized")
        return

    room = f"{normalized}:{resource_id}"
    client_id = f"u{user.id}-{uuid4().hex[:8]}"
    await websocket.accept()

    await hub.join(room, client_id, websocket, user_id=user.id, email=user.email)
    participants = await hub.participants(room)
    await websocket.send_json(
        {
            "type": "connected",
            "room": room,
            "client_id": client_id,
            "participants": participants,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )

    await hub.broadcast(
        room,
        {
            "type": "presence",
            "event": "join",
            "room": room,
            "client_id": client_id,
            "user": {"id": user.id, "email": user.email},
            "ts": datetime.now(timezone.utc).isoformat(),
        },
        exclude=client_id,
    )

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw.encode("utf-8")) > _MAX_MESSAGE_BYTES:
                await websocket.send_json(
                    {
                        "type": "error",
                        "error_code": "message_too_large",
                        "message": "Message exceeds size limit.",
                    }
                )
                continue

            try:
                incoming = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {
                        "type": "error",
                        "error_code": "invalid_json",
                        "message": "Message must be valid JSON.",
                    }
                )
                continue

            if not isinstance(incoming, dict):
                await websocket.send_json(
                    {
                        "type": "error",
                        "error_code": "invalid_payload",
                        "message": "Message must be a JSON object.",
                    }
                )
                continue

            msg_type_raw = incoming.get("type")
            msg_type = str(msg_type_raw).strip().lower() if isinstance(msg_type_raw, str) else "event"
            payload = incoming.get("payload")

            if msg_type in {"ping", "heartbeat"}:
                await websocket.send_json({"type": "pong", "ts": datetime.now(timezone.utc).isoformat()})
                continue

            await hub.broadcast(
                room,
                {
                    "type": msg_type or "event",
                    "room": room,
                    "client_id": client_id,
                    "user": {"id": user.id, "email": user.email},
                    "payload": payload,
                    "ts": datetime.now(timezone.utc).isoformat(),
                },
                exclude=client_id,
            )
    except WebSocketDisconnect:
        pass
    finally:
        await hub.leave(room, client_id)
        await hub.broadcast(
            room,
            {
                "type": "presence",
                "event": "leave",
                "room": room,
                "client_id": client_id,
                "user": {"id": user.id, "email": user.email},
                "ts": datetime.now(timezone.utc).isoformat(),
            },
        )
