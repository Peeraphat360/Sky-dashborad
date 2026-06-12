"""Supabase data access. The sync supabase-py client is run in a thread pool
so the FastAPI handlers stay async/non-blocking."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Callable, Optional, TypeVar

from supabase import Client, create_client

from .config import get_settings
from .schemas import BookingContext
from .utils import parse_dt

logger = logging.getLogger(__name__)

T = TypeVar("T")

# notifications.title values used as idempotency markers
TITLE_CONFIRMED = "BOOKING_CONFIRMED"
TITLE_RECEIPT = "RECEIPT_SENT"


class Repository:
    def __init__(self, client: Optional[Client] = None) -> None:
        if client is not None:
            self._client = client
        else:
            settings = get_settings()
            self._client = create_client(
                settings.supabase_url, settings.supabase_service_role_key
            )

    async def _run(self, fn: Callable[[], T]) -> T:
        return await asyncio.to_thread(fn)

    # ── Reads ────────────────────────────────────────────────
    async def get_booking_context(self, booking_id: str) -> Optional[BookingContext]:
        """Fetch booking + customer line_id + payment, assembled into a BookingContext."""
        booking = await self._run(
            lambda: self._first(
                self._client.table("bookings").select("*").eq("id", booking_id).limit(1)
            )
        )
        if not booking:
            return None

        # Both columns exist: the customer web (passport LINE login) writes
        # `line_user_id`, while the NestJS schema uses `line_id`. Read both and
        # prefer line_user_id so we work regardless of which path created the user.
        user = await self._run(
            lambda: self._first(
                self._client.table("users")
                .select("line_id,line_user_id,name")
                .eq("id", booking["user_id"])
                .limit(1)
            )
        )
        payment = await self._run(
            lambda: self._first(
                self._client.table("payments")
                .select("amount,method,status,paid_at")
                .eq("booking_id", booking_id)
                .limit(1)
            )
        )

        return BookingContext(
            booking_id=booking["id"],
            user_id=booking["user_id"],
            customer_name=booking.get("customer_name") or (user or {}).get("name") or "",
            line_user_id=(user or {}).get("line_user_id") or (user or {}).get("line_id") or "",
            vehicle_brand=booking.get("vehicle_brand") or "",
            vehicle_model=booking.get("vehicle_model") or "",
            vehicle_plate=booking.get("vehicle_plate") or "",
            start_time=parse_dt(booking["start_time"]),
            end_time=parse_dt(booking["end_time"]),
            fee=_to_float(booking.get("fee")),
            amount=_to_float((payment or {}).get("amount")),
            method=(payment or {}).get("method"),
            paid_at=_maybe_dt((payment or {}).get("paid_at")),
            payment_status=(payment or {}).get("status"),
        )

    # ── Idempotency log (notifications table) ────────────────
    async def already_sent(self, user_id: str, title: str, booking_id: str) -> bool:
        rows = await self._run(
            lambda: self._client.table("notifications")
            .select("id")
            .eq("user_id", user_id)
            .eq("title", title)
            .eq("message", booking_id)
            .limit(1)
            .execute()
            .data
        )
        return bool(rows)

    async def save_picture(self, user_id: str, picture_url: str) -> None:
        """เก็บรูปโปรไฟล์ LINE ล่าสุดของลูกค้า (ใช้แสดงใน dashboard)."""
        await self._run(
            lambda: self._client.table("users")
            .update({"picture_url": picture_url})
            .eq("id", user_id)
            .execute()
        )

    async def next_free_datetime(self, start: datetime, end: datetime) -> Optional[datetime]:
        """วันเวลาที่ช่องจอดจะเริ่มว่าง สำหรับช่วง [start, end] ที่เต็มอยู่ —
        = end_time ที่เร็วที่สุดในบรรดา booking ที่ครองช่อง (มี slot_id) และทับช่วงนี้.
        คืน None ถ้าหาไม่ได้."""
        start_iso = start.isoformat()
        end_iso = end.isoformat()
        rows = await self._run(
            lambda: self._client.table("bookings")
            .select("end_time")
            .not_.is_("slot_id", "null")
            .in_("status", ["PENDING", "CONFIRMED", "PARKED"])
            .lt("start_time", end_iso)
            .gt("end_time", start_iso)
            .order("end_time")
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        return parse_dt(rows[0]["end_time"])

    async def log_sent(self, user_id: str, title: str, booking_id: str) -> None:
        await self._run(
            lambda: self._client.table("notifications")
            .insert({"user_id": user_id, "title": title, "message": booking_id})
            .execute()
        )

    # ── helpers ──────────────────────────────────────────────
    @staticmethod
    def _first(query: Any) -> Optional[dict]:
        data = query.execute().data
        return data[0] if data else None


def _to_float(value: object) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _maybe_dt(value: object):
    if not value:
        return None
    try:
        return parse_dt(value)
    except (TypeError, ValueError):
        return None
