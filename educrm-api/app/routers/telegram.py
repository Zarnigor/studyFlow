"""
Telegram Bot — EduCRM
Funksiyalar:
  - To'lov eslatmalari (qarzdorlarga)
  - Davomat bildirishnomalari
  - Yangi ariza kelganda admin xabari
  - /start — talaba/admin ro'yxatdan o'tishi
  - /balance — talaba o'z to'lov holatini ko'rishi
"""

import asyncio
import hmac
import hashlib
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.session import get_db
from app.db.models import (
    TelegramSubscription, Student, Payment, User,
    PaymentStatus, UserRole
)
from app.core.config import get_settings
from app.core.security import get_current_user, require_admin
import structlog
import httpx

log      = structlog.get_logger()
settings = get_settings()

telegram_router = APIRouter(prefix="/telegram", tags=["Telegram"])

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


# ── Low-level send ─────────────────────────────────────────────
async def send_message(chat_id: int, text: str, parse_mode: str = "HTML") -> bool:
    if not settings.TELEGRAM_BOT_TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN not set, skipping message")
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{TELEGRAM_API}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
            )
            if not resp.json().get("ok"):
                log.error("Telegram send failed", result=resp.json())
                return False
        return True
    except Exception as e:
        log.error("Telegram send error", error=str(e))
        return False


async def send_to_admins(db: AsyncSession, branch_id: Optional[int], text: str):
    """Send a message to all admin subscriptions for a branch."""
    q = (
        select(TelegramSubscription)
        .join(User, User.id == TelegramSubscription.user_id)
        .where(
            TelegramSubscription.is_active == True,
            User.role.in_([UserRole.super_admin, UserRole.admin, UserRole.manager]),
        )
    )
    if branch_id:
        q = q.where(User.branch_id == branch_id)
    subs = (await db.execute(q)).scalars().all()
    for sub in subs:
        await send_message(sub.chat_id, text)


# ── Webhook signature verification ───────────────────────────
def verify_webhook(body: bytes, x_telegram_bot_api_secret_token: str) -> bool:
    if not settings.TELEGRAM_WEBHOOK_SECRET:
        return True  # dev mode — skip verification
    expected = hmac.new(
        settings.TELEGRAM_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, x_telegram_bot_api_secret_token or "")


# ── Webhook endpoint (aiogram FSM) ───────────────────────────
@telegram_router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=""),
):
    body = await request.body()
    if not verify_webhook(body, x_telegram_bot_api_secret_token):
        raise HTTPException(403, "Invalid webhook secret")

    update_data = await request.json()

    if settings.TELEGRAM_BOT_TOKEN:
        try:
            from app.bot.bot import process_update
            await process_update(update_data)
        except Exception as e:
            log.error("Bot process_update error", error=str(e))

    return {"ok": True}


# ── Webhook management endpoints ──────────────────────────────
@telegram_router.post("/set-webhook")
async def set_webhook_endpoint(_: User = Depends(require_admin)):
    """Register the webhook URL with Telegram (call once after deploy)."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN not configured")
    if not settings.TELEGRAM_WEBHOOK_URL:
        raise HTTPException(400, "TELEGRAM_WEBHOOK_URL not configured")

    try:
        from app.bot.bot import set_webhook
        await set_webhook()
        return {"success": True, "webhook_url": settings.TELEGRAM_WEBHOOK_URL}
    except Exception as e:
        raise HTTPException(500, str(e))


@telegram_router.get("/info")
async def bot_info(_: User = Depends(require_admin)):
    """Return current bot and webhook info from Telegram."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(400, "TELEGRAM_BOT_TOKEN not configured")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            me   = (await client.get(f"{TELEGRAM_API}/getMe")).json()
            hook = (await client.get(f"{TELEGRAM_API}/getWebhookInfo")).json()
        return {
            "success": True,
            "bot": me.get("result"),
            "webhook": hook.get("result"),
        }
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Notification helpers (called from other routers) ──────────
async def notify_payment_received(db: AsyncSession, payment: Payment):
    """Notify student that their payment was received."""
    sub = (await db.execute(
        select(TelegramSubscription).where(
            TelegramSubscription.student_id == payment.student_id,
            TelegramSubscription.is_active == True,
        )
    )).scalar_one_or_none()

    if sub:
        await send_message(
            sub.chat_id,
            f"✅ <b>To'lov qabul qilindi!</b>\n\n"
            f"💰 Summa: {int(payment.amount):,} so'm\n"
            f"📅 Davr: {payment.period_month}/{payment.period_year}\n"
            f"🧾 Chek: {payment.receipt_no}",
        )


async def notify_new_lead(db: AsyncSession, lead) -> None:
    """Notify branch admins about a new lead."""
    text = (
        f"🔔 <b>Yangi ariza!</b>\n\n"
        f"👤 Ism: {lead.full_name}\n"
        f"📞 Telefon: {lead.phone}\n"
        f"📚 Kurs: {lead.course_interest or '—'}\n"
        f"📣 Manba: {lead.source.value}"
    )
    await send_to_admins(db, lead.branch_id, text)


async def send_debt_reminders(db: AsyncSession, branch_id: Optional[int] = None):
    """
    Call this from a cron job (e.g. every 1st, 5th, 10th of month).
    Sends reminder to all students with debt status.
    """
    q = (
        select(Payment, TelegramSubscription)
        .join(TelegramSubscription, TelegramSubscription.student_id == Payment.student_id)
        .where(
            Payment.status == PaymentStatus.debt,
            TelegramSubscription.is_active == True,
        )
    )
    if branch_id:
        q = q.where(Payment.branch_id == branch_id)

    rows = (await db.execute(q)).all()
    sent = 0
    for row in rows:
        pay = row.Payment
        sub = row.TelegramSubscription
        ok = await send_message(
            sub.chat_id,
            f"⚠️ <b>To'lov eslatmasi</b>\n\n"
            f"💳 {pay.period_month}/{pay.period_year} uchun\n"
            f"💰 {int(pay.amount):,} so'm to'lanmagan.\n\n"
            "Iltimos, imkon qadar tezroq to'lang.\n"
            "📞 Savollar uchun markaz bilan bog'laning.",
        )
        if ok:
            sent += 1
    log.info("Debt reminders sent", count=sent)
    return sent


async def notify_low_attendance(db: AsyncSession, student_id: int, group_name: str, pct: float):
    sub = (await db.execute(
        select(TelegramSubscription).where(
            TelegramSubscription.student_id == student_id,
            TelegramSubscription.is_active == True,
        )
    )).scalar_one_or_none()

    if sub:
        await send_message(
            sub.chat_id,
            f"📉 <b>Davomat ogohlantirishi</b>\n\n"
            f"📚 Guruh: {group_name}\n"
            f"📊 Davomat: {pct}%\n\n"
            "Dars qoldirmaslikka harakat qiling!",
        )


# ── Admin API endpoints ────────────────────────────────────────
@telegram_router.post("/send-reminders")
async def trigger_reminders(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    count = await send_debt_reminders(db, branch_id)
    return {"success": True, "message": f"{count} ta eslatma yuborildi"}


@telegram_router.post("/broadcast")
async def broadcast(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Send a message to all active subscribers."""
    text       = body.get("text", "")
    branch_id  = body.get("branch_id")
    if not text:
        raise HTTPException(400, "text required")

    q = select(TelegramSubscription).where(TelegramSubscription.is_active == True)
    subs = (await db.execute(q)).scalars().all()
    sent = 0
    for sub in subs:
        ok = await send_message(sub.chat_id, text)
        if ok:
            sent += 1
        await asyncio.sleep(0.05)  # Telegram rate limit

    return {"success": True, "sent": sent}


@telegram_router.get("/stats")
async def telegram_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import func
    total  = (await db.execute(select(func.count(TelegramSubscription.id)))).scalar() or 0
    active = (await db.execute(
        select(func.count(TelegramSubscription.id)).where(TelegramSubscription.is_active == True)
    )).scalar() or 0
    return {"success": True, "data": {"total": total, "active": active}}
