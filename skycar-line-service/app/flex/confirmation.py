"""UC3 — แจ้งยืนยันการจอง (booking confirmed) Flex Message builder."""
from __future__ import annotations

from ..schemas import BookingContext
from ..utils import short_ref, thai_date
from . import theme


def build_confirmation_flex(ctx: BookingContext, *, logo_url: str, shop_phone: str) -> dict:
    """Return a compact LINE Flex *bubble* dict confirming a booking is reserved."""
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"
    period = f"{thai_date(ctx.start_time)} – {thai_date(ctx.end_time)}"

    header = {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": theme.PRIMARY,
        "paddingAll": "20px",
        "spacing": "sm",
        "contents": [
            {"type": "image", "url": logo_url, "size": "sm", "align": "center"},
            {
                "type": "text", "text": "ยืนยันการจองสำเร็จ", "color": "#ffffff",
                "weight": "bold", "size": "lg", "align": "center", "margin": "md",
            },
            {
                "type": "text", "text": "Sky Car Park", "color": theme.SUBTLE_ON_PRIMARY,
                "size": "xs", "align": "center",
            },
        ],
    }

    body = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "20px",
        "contents": [
            theme.info_row("เลขที่ booking", short_ref(ctx.booking_id)),
            theme.info_row("ชื่อผู้เช่า", ctx.customer_name or "-"),
            theme.info_row("รถ", f"{car} ({ctx.vehicle_plate})" if ctx.vehicle_plate else car),
            theme.info_row("ช่วงเช่า", period),
            theme.info_row("สถานะ", "รอชำระเงินที่หน้าร้าน", value_color=theme.ACCENT),
        ],
    }

    footer = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "16px",
        "spacing": "sm",
        "contents": [
            {
                "type": "text", "text": "กรุณานำรถมารับตามวันเวลาที่จอง",
                "size": "xs", "color": theme.TEXT_GREY, "align": "center", "wrap": True,
            },
            {
                "type": "text", "text": f"📞 ติดต่อสอบถาม: {shop_phone}",
                "size": "xs", "color": theme.TEXT_GREY, "align": "center",
            },
        ],
    }

    return {
        "type": "bubble",
        "header": header,
        "body": body,
        "footer": footer,
        "styles": {"footer": {"separator": True}},
    }
