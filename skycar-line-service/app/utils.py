"""Pure formatting helpers — Thai dates, money, rental day count, booking ref."""
from __future__ import annotations

from datetime import datetime

# Thai abbreviated month names (index 0 = January)
_THAI_MONTHS_ABBR = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
]


def parse_dt(value: object) -> datetime:
    """Parse a Supabase timestamp (ISO string, possibly trailing 'Z') into datetime."""
    if isinstance(value, datetime):
        return value
    if value is None:
        raise ValueError("datetime value is None")
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    return datetime.fromisoformat(text)


def thai_date(dt: datetime) -> str:
    """4 มิ.ย. 2567 — Buddhist year, Thai month abbreviation."""
    return f"{dt.day} {_THAI_MONTHS_ABBR[dt.month - 1]} {dt.year + 543}"


def thai_datetime(dt: datetime) -> str:
    """4 มิ.ย. 2567 14:32"""
    return f"{thai_date(dt)} {dt:%H:%M}"


def money(value: object) -> str:
    """Format a number with thousands separators. Drops .0 for whole numbers."""
    try:
        num = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return "0"
    if num.is_integer():
        return f"{int(num):,}"
    return f"{num:,.2f}"


def rental_days(start: datetime, end: datetime) -> int:
    """Number of rental days based on calendar dates (minimum 1)."""
    days = (end.date() - start.date()).days
    return days if days > 0 else 1


OFF_HOURS_FEE = 50  # ค่าบริการรับส่งนอกเวลา (ต่อเที่ยว)


def _is_off_hours(dt: datetime) -> bool:
    """ก่อน 08:00 หรือหลัง 21:00 = นอกเวลาให้บริการรับส่งฟรี."""
    minutes = dt.hour * 60 + dt.minute
    return minutes < 8 * 60 or minutes > 21 * 60


def off_hours_surcharge(start: datetime, end: datetime) -> int:
    """+50 ต่อเที่ยวที่อยู่นอกเวลา 08:00–21:00 (เข้าจอด/รับรถ) — รวมได้สูงสุด 100."""
    fee = 0
    if _is_off_hours(start):
        fee += OFF_HOURS_FEE
    if _is_off_hours(end):
        fee += OFF_HOURS_FEE
    return fee


def short_ref(booking_id: str) -> str:
    """Turn a uuid into a friendly reference like RC-9C18F969."""
    if not booking_id:
        return "-"
    head = booking_id.replace("-", "")[:8].upper()
    return f"RC-{head}"
