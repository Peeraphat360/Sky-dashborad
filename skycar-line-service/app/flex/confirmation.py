"""UC3 — ยืนยันการจอง / Booking Confirmed — สลิปโทนเหลือง/ทองให้เห็นเด่นชัด."""
from __future__ import annotations

from ..schemas import BookingContext
from ..utils import short_ref, thai_date
from . import theme


def build_confirmation_flex(ctx: BookingContext, *, logo_url: str, shop_phone: str) -> dict:
    """Return a premium LINE Flex *bubble* — yellow/gold themed confirmation slip."""
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"
    plate = ctx.vehicle_plate or "-"
    period = f"{thai_date(ctx.start_time)} – {thai_date(ctx.end_time)}"

    header = {
        "type": "box",
        "layout": "vertical",
        "background": theme.AMBER_GRADIENT,
        "paddingTop": "26px",
        "paddingBottom": "22px",
        "paddingStart": "20px",
        "paddingEnd": "20px",
        "spacing": "sm",
        "contents": [
            theme.logo_badge(logo_url),
            {"type": "text", "text": "ยืนยันการจองสำเร็จ", "color": "#ffffff",
             "weight": "bold", "size": "xl", "align": "center", "margin": "lg"},
            theme.gold_divider("#ffffff"),
            {"type": "text", "text": "BOOKING CONFIRMED", "color": "#fff7e6",
             "size": "xxs", "weight": "bold", "align": "center", "margin": "sm"},
            {"type": "text", "text": "Sky Car Park", "color": "#ffedcc",
             "size": "xs", "align": "center"},
        ],
    }

    status_block = {
        "type": "box",
        "layout": "vertical",
        "margin": "xl",
        "backgroundColor": "#ffffff",
        "cornerRadius": "14px",
        "paddingAll": "14px",
        "borderWidth": "2px",
        "borderColor": theme.AMBER,
        "contents": [
            {"type": "text", "text": "รอชำระเงินที่หน้าร้าน", "size": "sm",
             "color": theme.AMBER_DARK, "weight": "bold", "align": "center"},
            {"type": "text", "text": "Please pay at the counter", "size": "xxs",
             "color": "#a16207", "align": "center", "margin": "xs"},
        ],
    }

    # ── body: พื้นเหลืองอ่อน + กรอบเหลือง ให้เห็นเด่นชัด ──
    body = {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": theme.AMBER_SURFACE,
        "borderWidth": "2px",
        "borderColor": theme.AMBER_BORDER,
        "cornerRadius": "2px",
        "paddingAll": "22px",
        "contents": [
            theme.bi_row("เลขที่การจอง", "Booking No.", short_ref(ctx.booking_id),
                         value_color=theme.AMBER_DARK),
            theme.bi_row("ชื่อผู้เช่า", "Renter", ctx.customer_name or "-"),
            theme.bi_row("รถ", "Vehicle", car, sub_value=f"ทะเบียน {plate}"),
            theme.hairline(),
            theme.bi_row("ช่วงเช่า", "Rental period", period),
            status_block,
        ],
    }

    footer = {
        "type": "box",
        "layout": "vertical",
        "backgroundColor": theme.AMBER_SURFACE,
        "paddingAll": "18px",
        "spacing": "xs",
        "contents": [
            {"type": "text", "text": "กรุณานำรถมารับตามวันเวลาที่จอง", "size": "xs",
             "color": theme.TEXT_ON_AMBER, "align": "center", "wrap": True},
            {"type": "text", "text": "Please arrive on your booked date & time",
             "size": "xxs", "color": "#a16207", "align": "center", "wrap": True},
            {"type": "text", "text": f"📞 ติดต่อสอบถาม · Contact  {shop_phone}",
             "size": "xs", "color": "#a16207", "align": "center", "margin": "md", "wrap": True},
        ],
    }

    return {
        "type": "bubble",
        "size": "mega",
        "header": header,
        "body": body,
        "footer": footer,
        "styles": {"footer": {"separator": True, "separatorColor": theme.AMBER_BORDER}},
    }
