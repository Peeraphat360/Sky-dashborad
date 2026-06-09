"""UC5 — ใบเสร็จรับรถ / Official Receipt — premium bilingual Flex Message."""
from __future__ import annotations

from ..schemas import BookingContext
from ..utils import (
    money, off_hours_surcharge, rental_days, short_ref, thai_date, thai_datetime,
)
from . import theme


def build_receipt_flex(ctx: BookingContext, *, logo_url: str, shop_phone: str) -> dict:
    """Return a LINE Flex *bubble* dict for the rental receipt.

    Pure function: fully determined by its arguments — unit-test friendly.
    """
    days = rental_days(ctx.start_time, ctx.end_time)
    amount = ctx.amount if ctx.amount is not None else (ctx.fee or 0) * days
    per_day = ctx.fee if ctx.fee is not None else (amount / days if days else amount)
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"
    plate = ctx.vehicle_plate or "-"
    surcharge = off_hours_surcharge(ctx.start_time, ctx.end_time)

    # ── Hero header (gradient + logo medallion + gold accent) ──
    header = {
        "type": "box",
        "layout": "vertical",
        "background": theme.HEADER_GRADIENT,
        "paddingTop": "26px",
        "paddingBottom": "22px",
        "paddingStart": "20px",
        "paddingEnd": "20px",
        "spacing": "sm",
        "contents": [
            theme.logo_badge(logo_url),
            {"type": "text", "text": "ใบเสร็จรับรถ", "color": "#ffffff",
             "weight": "bold", "size": "xl", "align": "center", "margin": "lg"},
            theme.gold_divider(),
            {"type": "text", "text": "OFFICIAL RECEIPT", "color": theme.GOLD,
             "size": "xxs", "weight": "bold", "align": "center", "margin": "sm"},
            {"type": "text", "text": "Sky Car Park · ขอบคุณที่ใช้บริการ",
             "color": theme.SUBTLE_ON_PRIMARY, "size": "xs", "align": "center"},
        ],
    }

    # ── Body ──
    total_block = {
        "type": "box",
        "layout": "horizontal",
        "margin": "xl",
        "backgroundColor": theme.SURFACE_LIGHT,
        "cornerRadius": "16px",
        "paddingAll": "18px",
        "borderWidth": "1px",
        "borderColor": "#dceefb",
        "alignItems": "center",
        "contents": [
            {
                "type": "box", "layout": "vertical", "flex": 5,
                "contents": [
                    {"type": "text", "text": "รวมทั้งหมด", "size": "sm",
                     "color": theme.TEXT_DARK, "weight": "bold"},
                    {"type": "text", "text": "Total amount", "size": "xxs",
                     "color": theme.TEXT_FAINT},
                ],
            },
            {"type": "text", "text": f"฿{money(amount)}", "flex": 6, "align": "end",
             "size": "xxl", "color": theme.PRIMARY, "weight": "bold", "gravity": "center"},
        ],
    }

    body = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "22px",
        "contents": [
            theme.bi_row("เลขที่การจอง", "Booking No.", short_ref(ctx.booking_id),
                         value_color=theme.PRIMARY),
            theme.bi_row("ชื่อผู้เช่า", "Renter", ctx.customer_name or "-"),
            theme.bi_row("รถ", "Vehicle", car, sub_value=f"ทะเบียน {plate}"),
            theme.hairline(),
            theme.bi_row("วันรับรถ", "Pick-up", thai_date(ctx.start_time)),
            theme.bi_row("วันคืนรถ", "Return", thai_date(ctx.end_time)),
            theme.bi_row("จำนวนวัน", "Duration", f"{days} วัน · {days} day(s)"),
            theme.bi_row("ราคา/วัน", "Rate / day", f"{money(per_day)} บาท"),
            *([theme.bi_row(
                "ค่าบริการรับส่งนอกเวลา", "Off-hours fee",
                f"+{money(surcharge)} บาท", value_color=theme.AMBER_DARK,
            )] if surcharge else []),
            total_block,
        ],
    }

    # ── Footer (paid badge + contact) ──
    paid_line = "ชำระเงินแล้ว · Paid"
    paid_when = thai_datetime(ctx.paid_at) if ctx.paid_at is not None else ""

    footer = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "18px",
        "spacing": "md",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": theme.SUCCESS_BG,
                "cornerRadius": "12px",
                "paddingAll": "12px",
                "contents": [
                    {"type": "text", "text": f"✓  {paid_line}", "size": "sm",
                     "color": theme.SUCCESS, "weight": "bold", "align": "center"},
                    *([{"type": "text", "text": paid_when, "size": "xxs",
                        "color": theme.SUCCESS, "align": "center", "margin": "xs"}]
                      if paid_when else []),
                ],
            },
            {"type": "text", "text": f"📞 ติดต่อสอบถาม · Contact  {shop_phone}",
             "size": "xs", "color": theme.TEXT_FAINT, "align": "center", "wrap": True},
        ],
    }

    return {
        "type": "bubble",
        "size": "mega",
        "header": header,
        "body": body,
        "footer": footer,
        "styles": {"footer": {"separator": True, "separatorColor": theme.HAIRLINE}},
    }
