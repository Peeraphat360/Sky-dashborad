"""Thin async wrapper around the LINE Messaging API push endpoint."""
from __future__ import annotations

import logging

import httpx

from .config import get_settings

logger = logging.getLogger(__name__)

LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"


class LinePushError(RuntimeError):
    """Raised when LINE returns a non-200 response. Carries the HTTP status."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


async def push_flex(line_user_id: str, flex_bubble: dict, alt_text: str) -> None:
    """Push a single Flex Message (bubble) to a LINE user.

    Raises LinePushError if LINE rejects the request.
    """
    settings = get_settings()
    if not settings.line_channel_access_token:
        raise LinePushError("LINE_CHANNEL_ACCESS_TOKEN is not configured")

    headers = {
        "Authorization": f"Bearer {settings.line_channel_access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "to": line_user_id,
        "messages": [
            {"type": "flex", "altText": alt_text, "contents": flex_bubble},
        ],
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(LINE_PUSH_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        logger.error("LINE push failed %s: %s", resp.status_code, resp.text)
        raise LinePushError(
            f"LINE push failed ({resp.status_code}): {resp.text}",
            status_code=resp.status_code,
        )

    logger.info("LINE push delivered to %s", line_user_id)


async def get_profile(line_user_id: str) -> dict | None:
    """Fetch a customer's LINE profile (name, pictureUrl, …) via the Messaging API.
    Returns None if the user isn't reachable (e.g. hasn't added the OA as a friend)."""
    settings = get_settings()
    if not settings.line_channel_access_token:
        return None
    headers = {"Authorization": f"Bearer {settings.line_channel_access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.line.me/v2/bot/profile/{line_user_id}", headers=headers
        )
    if resp.status_code == 200:
        return resp.json()
    logger.info("get_profile %s -> %s", line_user_id, resp.status_code)
    return None
