"""Unit tests for the pure formatting helpers and Flex builders.

No network / Supabase / LINE needed — builders are pure functions.
"""
from __future__ import annotations

from datetime import datetime

from app.flex.confirmation import build_confirmation_flex
from app.flex.receipt import build_receipt_flex
from app.schemas import BookingContext
from app.utils import money, rental_days, short_ref, thai_date, thai_datetime

LOGO = "https://example.com/logo.png"
PHONE = "082-325-8380"


def sample() -> BookingContext:
    return BookingContext(
        booking_id="9c18f969-1ae9-41a8-9643-68d1e136a26a",
        user_id="user-1",
        customer_name="สมชาย ใจดี",
        line_user_id="U1234567890",
        vehicle_brand="Toyota",
        vehicle_model="Yaris",
        vehicle_plate="กข-1234",
        start_time=datetime(2024, 6, 4, 1, 0),
        end_time=datetime(2024, 6, 7, 1, 0),
        fee=800,
        amount=2400,
        method="QR",
        paid_at=datetime(2024, 6, 4, 14, 32),
        payment_status="PAID",
    )


def _collect_text(node) -> list[str]:
    out: list[str] = []
    if isinstance(node, dict):
        if node.get("type") == "text":
            out.append(node.get("text", ""))
        for value in node.values():
            out.extend(_collect_text(value))
    elif isinstance(node, list):
        for value in node:
            out.extend(_collect_text(value))
    return out


# ── utils ────────────────────────────────────────────────────
def test_thai_date_buddhist_year():
    assert thai_date(datetime(2024, 6, 4)) == "4 มิ.ย. 2567"


def test_thai_datetime():
    assert thai_datetime(datetime(2024, 6, 4, 14, 32)) == "4 มิ.ย. 2567 14:32"


def test_money_whole_and_decimal():
    assert money(2400) == "2,400"
    assert money(2400.5) == "2,400.50"
    assert money(None) == "0"


def test_rental_days():
    assert rental_days(datetime(2024, 6, 4), datetime(2024, 6, 7)) == 3
    # same-day rental counts as 1
    assert rental_days(datetime(2024, 6, 4, 9), datetime(2024, 6, 4, 18)) == 1


def test_short_ref():
    assert short_ref("9c18f969-1ae9-41a8-9643-68d1e136a26a") == "RC-9C18F969"
    assert short_ref("") == "-"


# ── receipt flex ─────────────────────────────────────────────
def test_receipt_flex_structure_and_content():
    bubble = build_receipt_flex(sample(), logo_url=LOGO, shop_phone=PHONE)
    assert bubble["type"] == "bubble"
    assert {"header", "body", "footer"} <= bubble.keys()

    texts = _collect_text(bubble)
    joined = " ".join(texts)
    assert "ใบเสร็จรับรถ" in joined
    assert "Toyota Yaris" in joined
    assert "กข-1234" in joined
    assert "3 วัน" in joined
    assert "2,400 บาท" in joined          # total
    assert "ชำระเงินแล้ว" in joined
    assert "082-325-8380" in joined
    assert any(LOGO == img.get("url") for img in _images(bubble))


def test_receipt_total_falls_back_to_fee_times_days():
    ctx = sample()
    ctx.amount = None  # no payment amount → fee * days
    bubble = build_receipt_flex(ctx, logo_url=LOGO, shop_phone=PHONE)
    assert "2,400 บาท" in " ".join(_collect_text(bubble))


# ── confirmation flex ────────────────────────────────────────
def test_confirmation_flex_structure_and_content():
    bubble = build_confirmation_flex(sample(), logo_url=LOGO, shop_phone=PHONE)
    assert bubble["type"] == "bubble"
    joined = " ".join(_collect_text(bubble))
    assert "ยืนยันการจอง" in joined
    assert "รอชำระเงินที่หน้าร้าน" in joined
    assert "4 มิ.ย. 2567 – 7 มิ.ย. 2567" in joined


def _images(node) -> list[dict]:
    out: list[dict] = []
    if isinstance(node, dict):
        if node.get("type") == "image":
            out.append(node)
        for value in node.values():
            out.extend(_images(value))
    elif isinstance(node, list):
        for value in node:
            out.extend(_images(value))
    return out
