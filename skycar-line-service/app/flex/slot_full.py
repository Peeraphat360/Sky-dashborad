"""แจ้งลูกค้าว่าช่วงวันที่เลือกช่องจอดเต็ม — โทนแดง/เตือน + วันที่ช่องจะว่าง."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from ..schemas import BookingContext
from ..utils import thai_date
from . import theme

# โทนแดงเฉพาะสลิปนี้ (ไม่อยู่ใน theme กลาง)
RED = "#dc2626"        # red-600
RED_DARK = "#991b1b"   # red-800
RED_SURFACE = "#fef2f2"  # red-50
RED_BORDER = "#fecaca"   # red-200

RED_GRADIENT = {
    "type": "linearGradient",
    "angle": "160deg",
    "startColor": "#7f1d1d",
    "endColor": "#dc2626",
}


def build_slot_full_flex(
    ctx: BookingContext,
    next_free: Optional[datetime],
    *,
    logo_url: str,
    shop_phone: str,
) -> dict:
    """Flex bubble แจ้งว่าช่วงวันที่จองเต็ม + วันที่คาดว่าจะว่าง."""
    car = f"{ctx.vehicle_brand} {ctx.vehicle_model}".strip() or "-"
    period = f"{thai_date(ctx.start_time)} – {thai_date(ctx.end_time)}"

    header = {
        "type": "box",
        "layout": "vertical",
        "background": RED_GRADIENT,
        "paddingTop": "26px",
        "paddingBottom": "22px",
        "paddingStart": "20px",
        "paddingEnd": "20px",
        "spacing": "sm",
        "contents": [
            theme.logo_badge(logo_url),
            {"type": "text", "text": "ช่องจอดเต็ม", "color": "#ffffff",
             "weight": "bold", "size": "xl", "align": "center", "margin": "lg"},
            theme.gold_divider(color="#fca5a5"),
            {"type": "text", "text": "PARKING FULL", "color": "#fecaca",
             "size": "xxs", "weight": "bold", "align": "center", "margin": "sm"},
            {"type": "text", "text": "Sky Car Park", "color": "#fecaca",
             "size": "xs", "align": "center"},
        ],
    }

    # กล่องข้อความหลัก
    notice = {
        "type": "box",
        "layout": "vertical",
        "margin": "xl",
        "backgroundColor": RED_SURFACE,
        "cornerRadius": "14px",
        "paddingAll": "14px",
        "borderWidth": "1px",
        "borderColor": RED_BORDER,
        "contents": [
            {"type": "text",
             "text": f"ขออภัยค่ะ ช่วงวันที่คุณ{ctx.customer_name or 'ลูกค้า'}เลือกไว้ ช่องจอดเต็มแล้ว",
             "size": "sm", "color": RED_DARK, "weight": "bold", "wrap": True, "align": "center"},
            {"type": "text",
             "text": "We're sorry — all slots are full for your selected dates.",
             "size": "xxs", "color": theme.TEXT_FAINT, "wrap": True, "align": "center", "margin": "sm"},
        ],
    }

    rows = [
        theme.bi_row("ช่วงเวลาที่ขอจอง", "Requested period", period),
        theme.bi_row("รถ", "Vehicle", car, sub_value=ctx.vehicle_plate or None),
    ]

    if next_free is not None:
        rows.append(theme.hairline())
        rows.append(
            theme.bi_row("ช่องจะเริ่มว่างประมาณ", "Next slot likely free",
                         thai_date(next_free), value_color=theme.SUCCESS)
        )
        cta_text = "หากต้องการจองใหม่ กรุณาเลือกวันตั้งแต่วันดังกล่าวเป็นต้นไป หรือติดต่อร้านเพื่อสอบถามคิวว่างค่ะ"
    else:
        cta_text = "กรุณาติดต่อร้านเพื่อสอบถามคิวว่าง หรือลองจองใหม่ในวันอื่นค่ะ"

    body = {
        "type": "box",
        "layout": "vertical",
        "paddingStart": "20px",
        "paddingEnd": "20px",
        "paddingTop": "8px",
        "paddingBottom": "20px",
        "contents": [
            notice,
            {"type": "box", "layout": "vertical", "margin": "lg", "contents": rows},
            theme.hairline(),
            {"type": "text", "text": cta_text, "size": "xxs", "color": theme.TEXT_GREY,
             "wrap": True, "align": "center", "margin": "lg"},
            {"type": "text", "text": f"โทร {shop_phone}" if shop_phone else "",
             "size": "xs", "color": theme.ACCENT, "weight": "bold", "align": "center", "margin": "sm"},
        ],
    }

    return {
        "type": "bubble",
        "size": "mega",
        "header": header,
        "body": body,
        "styles": {"body": {"backgroundColor": "#ffffff"}},
    }
