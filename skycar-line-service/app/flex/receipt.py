"""UC5 — ใบเสร็จรับรถ (receipt) Flex Message builder."""
from __future__ import annotations

from ..schemas import BookingContext
from ..utils import money, rental_days, short_ref, thai_date, thai_datetime
from . import theme


def build_receipt_flex(ctx: BookingContext, *, logo_url: str, shop_phone: str) -> dict:
    """Return a LINE Flex *bubble* dict for the rental receipt.

    Pure function: no I/O, fully determined by its arguments — unit-test friendly.
    """
    days = rental_days(ctx.start_time, ctx.end_time)
    amount = ctx.amount if ctx.amount is not None else (ctx.fee or 0) * days
    per_day = ctx.fee if ctx.fee is not None else (amount / days if days else amount)
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"

    # ── Header (blue) ──
    header = {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": theme.PRIMARY,
        "paddingAll": "20px",
        "spacing": "sm",
        "contents": [
            {"type": "image", "url": logo_url, "size": "sm", "align": "center"},
            {
                "type": "text", "text": "ใบเสร็จรับรถ", "color": "#ffffff",
                "weight": "bold", "size": "xl", "align": "center", "margin": "md",
            },
            {
                "type": "text", "text": "Sky Car Park — ขอบคุณที่ใช้บริการ",
                "color": theme.SUBTLE_ON_PRIMARY, "size": "xs", "align": "center",
            },
        ],
    }

    # ── Body (white) ──
    car_block = {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
            {"type": "text", "text": "รถ", "size": "sm", "color": theme.TEXT_GREY, "flex": 4},
            {
                "type": "box", "layout": "vertical", "flex": 6,
                "contents": [
                    {"type": "text", "text": car, "size": "sm", "color": theme.TEXT_DARK,
                     "weight": "bold", "align": "end", "wrap": True},
                    {"type": "text", "text": ctx.vehicle_plate or "-", "size": "xs",
                     "color": theme.TEXT_GREY, "align": "end"},
                ],
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
            car_block,
            theme.info_row("วันรับรถ", thai_date(ctx.start_time)),
            theme.info_row("วันคืนรถ", thai_date(ctx.end_time)),
            theme.info_row("จำนวนวัน", f"{days} วัน"),
            theme.info_row("ราคา/วัน", f"{money(per_day)} บาท"),
            {"type": "separator", "margin": "lg", "color": "#e2e8f0"},
            {
                "type": "box",
                "layout": "horizontal",
                "margin": "lg",
                "contents": [
                    {"type": "text", "text": "รวมทั้งหมด", "size": "md",
                     "color": theme.TEXT_DARK, "weight": "bold", "flex": 4, "gravity": "center"},
                    {"type": "text", "text": f"{money(amount)} บาท", "size": "xl",
                     "color": theme.PRIMARY, "weight": "bold", "align": "end", "flex": 6},
                ],
            },
        ],
    }

    # ── Footer ──
    paid_text = "ชำระเงินแล้ว"
    if ctx.paid_at is not None:
        paid_text = f"ชำระเงินแล้ว · {thai_datetime(ctx.paid_at)}"

    footer = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "16px",
        "spacing": "sm",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": theme.SUCCESS_BG,
                "cornerRadius": "md",
                "paddingAll": "10px",
                "contents": [
                    {"type": "text", "text": paid_text, "size": "sm",
                     "color": theme.SUCCESS, "weight": "bold", "align": "center", "wrap": True},
                ],
            },
            {
                "type": "text",
                "text": f"📞 ติดต่อสอบถาม: {shop_phone}",
                "size": "xs", "color": theme.TEXT_GREY, "align": "center", "margin": "md",
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
