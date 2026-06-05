"""FastAPI entrypoint — manual endpoints + Supabase webhook receivers."""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .repository import Repository
from .schemas import SendResult, SupabaseWebhookPayload
from .services import send_confirmation, send_receipt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skycar-line-service")

app = FastAPI(title="SkyCarPark LINE Service", version="1.0.0")

# Allow the dashboard frontend to call the manual endpoints from the browser.
# localhost ports (Vite dev) always allowed via regex; production origins (e.g. the
# Netlify URL) come from the CORS_ORIGINS env var, comma-separated.
_prod_origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_prod_origins,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

# One repository (and Supabase client) per process.
_repo: Repository | None = None


def get_repo() -> Repository:
    global _repo
    if _repo is None:
        _repo = Repository()
    return _repo


def verify_webhook_secret(x_webhook_secret: str | None = Header(default=None)) -> None:
    """Guard for /webhooks/* — compares X-Webhook-Secret to WEBHOOK_SECRET."""
    expected = get_settings().webhook_secret
    if not x_webhook_secret or x_webhook_secret != expected:
        raise HTTPException(status_code=401, detail="invalid webhook secret")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


# ── Manual endpoints (handy for local testing via curl) ──────────────────────
@app.post("/receipts/{booking_id}/send", response_model=SendResult)
async def receipts_send(booking_id: str, repo: Repository = Depends(get_repo)) -> SendResult:
    return await send_receipt(repo, booking_id)


@app.post("/notifications/{booking_id}/confirmed", response_model=SendResult)
async def notifications_confirmed(
    booking_id: str, repo: Repository = Depends(get_repo)
) -> SendResult:
    return await send_confirmation(repo, booking_id)


# ── Supabase Database Webhook receivers ──────────────────────────────────────
@app.post(
    "/webhooks/booking-confirmed",
    response_model=SendResult,
    dependencies=[Depends(verify_webhook_secret)],
)
async def webhook_booking_confirmed(
    payload: SupabaseWebhookPayload, repo: Repository = Depends(get_repo)
) -> SendResult:
    record = payload.record or {}
    old = payload.old_record or {}
    booking_id = record.get("id")
    if not booking_id:
        raise HTTPException(status_code=400, detail="missing record.id")

    # Fire only on the AVAILABLE→CONFIRMED edge so we notify exactly once.
    if record.get("status") != "CONFIRMED" or old.get("status") == "CONFIRMED":
        return SendResult(sent=False, booking_id=booking_id, reason="not_a_confirm_edge")

    return await send_confirmation(repo, booking_id)


@app.post(
    "/webhooks/payment-paid",
    response_model=SendResult,
    dependencies=[Depends(verify_webhook_secret)],
)
async def webhook_payment_paid(
    payload: SupabaseWebhookPayload, repo: Repository = Depends(get_repo)
) -> SendResult:
    record = payload.record or {}
    booking_id = record.get("booking_id")
    if not booking_id:
        raise HTTPException(status_code=400, detail="missing record.booking_id")

    if record.get("status") != "PAID":
        return SendResult(sent=False, booking_id=booking_id, reason="payment_not_paid")

    return await send_receipt(repo, booking_id)
