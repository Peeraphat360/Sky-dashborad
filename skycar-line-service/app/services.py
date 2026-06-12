"""Application services — orchestrate fetch → build flex → push → log.

Raise HTTPException with clear messages; FastAPI turns them into proper responses.
"""
from __future__ import annotations

import logging

from fastapi import HTTPException

from .config import get_settings
from .flex.confirmation import build_confirmation_flex
from .flex.receipt import build_receipt_flex
from .flex.slot_full import build_slot_full_flex
from .line_client import LinePushError, get_profile, push_flex
from .repository import Repository, TITLE_CONFIRMED, TITLE_RECEIPT
from .schemas import BookingContext, SendResult

logger = logging.getLogger(__name__)


async def _load(repo: Repository, booking_id: str) -> BookingContext:
    ctx = await repo.get_booking_context(booking_id)
    if ctx is None:
        raise HTTPException(status_code=404, detail=f"booking not found: {booking_id}")
    if not ctx.line_user_id:
        raise HTTPException(
            status_code=422,
            detail=f"customer has no line_id; cannot push (booking {booking_id})",
        )
    return ctx


async def _deliver(repo: Repository, ctx: BookingContext, title: str,
                   bubble: dict, alt_text: str) -> SendResult:
    if await repo.already_sent(ctx.user_id, title, ctx.booking_id):
        return SendResult(sent=False, booking_id=ctx.booking_id, reason="already_sent")
    try:
        await push_flex(ctx.line_user_id, bubble, alt_text)
    except LinePushError as exc:
        # 400/403 = ผู้รับยังไม่ได้ add OA เป็นเพื่อน / บล็อก / userId ใช้กับ channel นี้ไม่ได้.
        # ถือเป็นผลลัพธ์ที่คาดได้ (ไม่ใช่ระบบพัง) → ตอบ 200 sent=false และ "ไม่" log กันส่งซ้ำ
        # เพื่อให้ลองส่งใหม่ได้เมื่อลูกค้า add เพื่อนแล้ว
        if exc.status_code in (400, 403):
            logger.warning("recipient unreachable for %s: %s", ctx.booking_id, exc)
            return SendResult(
                sent=False, booking_id=ctx.booking_id, reason="recipient_not_friend"
            )
        # error อื่น (401 token ผิด, 5xx ฝั่ง LINE) ถือว่าระบบมีปัญหาจริง
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    await repo.log_sent(ctx.user_id, title, ctx.booking_id)
    # best-effort: เก็บรูปโปรไฟล์ LINE ของลูกค้าไว้ใช้แสดงใน dashboard (push สำเร็จ
    # = เป็นเพื่อน OA → bot/profile ใช้ได้) — ถ้าพลาดไม่กระทบการส่ง
    await _update_picture(repo, ctx)
    return SendResult(sent=True, booking_id=ctx.booking_id)


async def _update_picture(repo: Repository, ctx: BookingContext) -> None:
    try:
        profile = await get_profile(ctx.line_user_id)
        pic = (profile or {}).get("pictureUrl")
        if pic:
            await repo.save_picture(ctx.user_id, pic)
    except Exception as exc:  # noqa: BLE001 — best-effort, ห้ามให้ล้มทั้ง flow
        logger.warning("picture update failed for %s: %s", ctx.booking_id, exc)


async def send_receipt(repo: Repository, booking_id: str) -> SendResult:
    """UC5 — send the rental receipt. Requires the payment to be PAID."""
    ctx = await _load(repo, booking_id)
    if ctx.payment_status != "PAID":
        raise HTTPException(
            status_code=409,
            detail=f"payment not PAID yet (status={ctx.payment_status}) for {booking_id}",
        )
    settings = get_settings()
    bubble = build_receipt_flex(ctx, logo_url=settings.logo_url, shop_phone=settings.shop_phone)
    return await _deliver(repo, ctx, TITLE_RECEIPT, bubble, alt_text=f"ใบเสร็จรับรถ {booking_id}")


async def send_confirmation(repo: Repository, booking_id: str) -> SendResult:
    """UC3 — send the booking-confirmed notification."""
    ctx = await _load(repo, booking_id)
    settings = get_settings()
    bubble = build_confirmation_flex(ctx, logo_url=settings.logo_url, shop_phone=settings.shop_phone)
    return await _deliver(
        repo, ctx, TITLE_CONFIRMED, bubble, alt_text=f"ยืนยันการจอง {booking_id}"
    )


async def send_slot_full(repo: Repository, booking_id: str) -> SendResult:
    """แจ้งลูกค้าว่าช่วงวันที่จองเต็ม + วันที่ช่องจะว่าง (คำนวณอัตโนมัติ).
    ไม่ใช้ idempotency log เพราะเป็น action ที่แอดมินกดเอง — push ตรงทันที."""
    ctx = await _load(repo, booking_id)
    settings = get_settings()
    next_free = await repo.next_free_datetime(ctx.start_time, ctx.end_time)
    bubble = build_slot_full_flex(
        ctx, next_free, logo_url=settings.logo_url, shop_phone=settings.shop_phone
    )
    try:
        await push_flex(ctx.line_user_id, bubble, alt_text="ช่องจอดเต็มในวันที่คุณเลือก")
    except LinePushError as exc:
        if exc.status_code in (400, 403):
            return SendResult(sent=False, booking_id=booking_id, reason="recipient_not_friend")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SendResult(sent=True, booking_id=booking_id)
