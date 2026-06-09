"""UC3 — ยืนยันการจอง / Booking Confirmed — โทนฟ้า (แบรนด์) + กล่องเตือนค่าบริการนอกเวลา."""
from __future__ import annotations

from ..schemas import BookingContext
from ..utils import short_ref, thai_date
from . import theme


def build_confirmation_flex(ctx: BookingContext, *, logo_url: str, shop_phone: str) -> dict:
    """Return a premium LINE Flex *bubble* confirming a booking (sky-blue theme)."""
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"
    plate = ctx.vehicle_plate or "-"
    period = f"{thai_date(ctx.start_time)} – {thai_date(ctx.end_time)}"

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
            {"type": "text", "text": "ยืนยันการจองสำเร็จ", "color": "#ffffff",
             "weight": "bold", "size": "xl", "align": "center", "margin": "lg"},
            theme.gold_divider(),
            {"type": "text", "text": "BOOKING CONFIRMED", "color": theme.GOLD,
             "size": "xxs", "weight": "bold", "align": "center", "margin": "sm"},
            {"type": "text", "text": "Sky Car Park", "color": theme.SUBTLE_ON_PRIMARY,
             "size": "xs", "align": "center"},
        ],
    }

    status_block = {
        "type": "box",
        "layout": "vertical",
        "margin": "xl",
        "backgroundColor": theme.SURFACE_LIGHT,
        "cornerRadius": "14px",
        "paddingAll": "14px",
        "borderWidth": "1px",
        "borderColor": "#dceefb",
        "contents": [
            {"type": "text", "text": "รอชำระเงินที่หน้าร้าน", "size": "sm",
             "color": theme.ACCENT, "weight": "bold", "align": "center"},
            {"type": "text", "text": "Please pay at the counter", "size": "xxs",
             "color": theme.TEXT_FAINT, "align": "center", "margin": "xs"},
        ],
    }

    # ── กล่องเตือนค่าบริการนอกเวลา (พื้นเหลือง) ──
    off_hours_note = {
        "type": "box",
        "layout": "horizontal",
        "margin": "lg",
        "spacing": "sm",
        "backgroundColor": theme.AMBER_SURFACE,
        "cornerRadius": "12px",
        "paddingAll": "12px",
        "borderWidth": "1px",
        "borderColor": theme.AMBER_BORDER,
        "contents": [
            {"type": "text", "text": "⚠️", "flex": 0, "size": "sm"},
            {
                "type": "box", "layout": "vertical", "flex": 1,
                "contents": [
                    {"type": "text", "text": "ค่าบริการรับส่งนอกเวลา +50 บาท/เที่ยว",
                     "size": "xs", "color": theme.TEXT_ON_AMBER, "weight": "bold", "wrap": True},
                    {"type": "text", "text": "เข้าจอด/รับรถ ก่อน 08:00 หรือหลัง 21:00 น.",
                     "size": "xxs", "color": "#a16207", "wrap": True, "margin": "xs"},
                ],
            },
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
            theme.bi_row("ช่วงเช่า", "Rental period", period),
            status_block,
            off_hours_note,
        ],
    }

    footer = {
        "type": "box",
        "layout": "vertical",
        "paddingAll": "18px",
        "spacing": "xs",
        "contents": [
            {"type": "text", "text": "กรุณานำรถมารับตามวันเวลาที่จอง", "size": "xs",
             "color": theme.TEXT_GREY, "align": "center", "wrap": True},
            {"type": "text", "text": "Please arrive on your booked date & time",
             "size": "xxs", "color": theme.TEXT_FAINT, "align": "center", "wrap": True},
            {"type": "text", "text": f"📞 ติดต่อสอบถาม · Contact  {shop_phone}",
             "size": "xs", "color": theme.TEXT_FAINT, "align": "center", "margin": "md", "wrap": True},
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
