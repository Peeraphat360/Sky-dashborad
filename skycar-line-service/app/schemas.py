"""Data models — internal booking context + Supabase webhook payload."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


@dataclass
class BookingContext:
    """Everything the Flex builders need, already parsed/typed.

    Pure data — no Supabase/LINE dependency — so the builders are easy to unit test.
    """
    booking_id: str
    user_id: str
    customer_name: str
    line_user_id: str
    vehicle_brand: str
    vehicle_model: str
    vehicle_plate: str
    start_time: datetime
    end_time: datetime
    fee: Optional[float] = None             # ราคา/วัน (อาจไม่มี)
    amount: Optional[float] = None          # ยอดชำระจริงจากตาราง payments
    method: Optional[str] = None            # CASH / QR / PROMPTPAY
    paid_at: Optional[datetime] = None
    payment_status: Optional[str] = None    # PENDING / PAID


class SupabaseWebhookPayload(BaseModel):
    """Shape Supabase Database Webhooks POST to us."""
    model_config = ConfigDict(populate_by_name=True)

    type: str                                          # INSERT / UPDATE / DELETE
    table: str
    schema_name: str = Field(default="public", alias="schema")
    record: Optional[dict[str, Any]] = None
    old_record: Optional[dict[str, Any]] = None


class SendResult(BaseModel):
    sent: bool
    booking_id: str
    reason: Optional[str] = None
