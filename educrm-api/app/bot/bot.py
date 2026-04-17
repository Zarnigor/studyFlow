"""
StudyFlow Telegram Bot — Teacher Attendance
FSM flow: /start → phone → group → lesson → mark attendance → save
"""
import logging
from datetime import date, time as dtime, datetime

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton,
    ReplyKeyboardRemove,
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.db.models import (
    Teacher, Group, Lesson, Attendance,
    StudentGroup, Student, AttStatus, User, UserRole,
)

settings = get_settings()
log      = logging.getLogger(__name__)

# ── Bot & dispatcher ──────────────────────────────────────────────
bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
dp  = Dispatcher(storage=MemoryStorage())


# ── FSM states ────────────────────────────────────────────────────
class AttFlow(StatesGroup):
    waiting_phone   = State()
    choosing_group  = State()
    choosing_lesson = State()
    marking_att     = State()


# ── DB helpers ────────────────────────────────────────────────────
async def get_teacher_by_phone(phone: str):
    """Find teacher + their user_id by phone number."""
    clean = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not clean.startswith("+"):
        clean = "+" + clean

    async with AsyncSessionLocal() as db:
        # Try Teacher table directly
        result = await db.execute(
            select(Teacher).where(Teacher.phone == clean)
        )
        teacher = result.scalar_one_or_none()

        # Also try via User (teacher role)
        if not teacher:
            user_res = await db.execute(
                select(User).where(User.phone == clean, User.role == UserRole.teacher)
            )
            user = user_res.scalar_one_or_none()
            if user:
                t_res = await db.execute(
                    select(Teacher).where(Teacher.user_id == user.id)
                )
                teacher = t_res.scalar_one_or_none()

        return teacher


async def get_teacher_groups(teacher_id: int):
    """Get active groups for a teacher, ordered by name."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Group)
            .where(Group.teacher_id == teacher_id, Group.is_active == True)
            .order_by(Group.name)
        )
        return result.scalars().all()


async def get_today_lessons(group_id: int):
    """Get today's non-cancelled lessons for a group."""
    today = date.today()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Lesson)
            .options(selectinload(Lesson.attendances))
            .where(
                Lesson.group_id    == group_id,
                Lesson.lesson_date == today,
                Lesson.is_cancelled == False,
            )
            .order_by(Lesson.start_time)
        )
        return result.scalars().all()


async def get_group_students(group_id: int):
    """Get active StudentGroup rows (with student eager-loaded)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(StudentGroup)
            .options(selectinload(StudentGroup.student))
            .where(
                StudentGroup.group_id  == group_id,
                StudentGroup.is_active == True,
            )
            .order_by(StudentGroup.id)
        )
        return result.scalars().all()


async def get_group_name(group_id: int) -> str:
    async with AsyncSessionLocal() as db:
        g = (await db.execute(
            select(Group).where(Group.id == group_id)
        )).scalar_one_or_none()
        return g.name if g else f"Guruh #{group_id}"


async def create_lesson_for_today(group_id: int, teacher_id: int) -> tuple[int, int]:
    """Create a lesson for today, pre-fill attendance as 'present'. Returns (lesson_id, student_count)."""
    now   = datetime.now()
    start = dtime(now.hour, now.minute)
    end   = dtime((now.hour + 2) % 24, now.minute)

    async with AsyncSessionLocal() as db:
        lesson = Lesson(
            group_id    = group_id,
            teacher_id  = teacher_id,
            lesson_date = date.today(),
            start_time  = start,
            end_time    = end,
        )
        db.add(lesson)
        await db.flush()

        sgs = (await db.execute(
            select(StudentGroup).where(
                StudentGroup.group_id  == group_id,
                StudentGroup.is_active == True,
            )
        )).scalars().all()

        for sg in sgs:
            db.add(Attendance(
                lesson_id  = lesson.id,
                student_id = sg.student_id,
                status     = AttStatus.present,
            ))

        await db.commit()
        return lesson.id, len(sgs)


async def save_attendance(lesson_id: int, att_data: dict):
    """Upsert attendance. att_data = {str(student_id): status_str}"""
    async with AsyncSessionLocal() as db:
        for student_id_str, status_str in att_data.items():
            try:
                status = AttStatus(status_str)
            except ValueError:
                status = AttStatus.present

            sid = int(student_id_str)
            existing = (await db.execute(
                select(Attendance).where(
                    Attendance.lesson_id  == lesson_id,
                    Attendance.student_id == sid,
                )
            )).scalar_one_or_none()

            if existing:
                existing.status = status
            else:
                db.add(Attendance(
                    lesson_id  = lesson_id,
                    student_id = sid,
                    status     = status,
                ))

        await db.commit()


# ── Keyboard helpers ──────────────────────────────────────────────
def kb_phone():
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Telefon raqamimni yuborish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def kb_groups(groups):
    rows = [[InlineKeyboardButton(text=f"👥 {g.name}", callback_data=f"group:{g.id}")]
            for g in groups]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def kb_lessons(lessons, group_id: int):
    rows = []
    for l in lessons:
        t   = str(l.start_time)[:5]          # "HH:MM"
        atts = l.attendances or []
        ok  = len([a for a in atts if a.status == AttStatus.present])
        lbl = f"🕐 {t}"
        if l.topic:
            lbl += f" — {l.topic[:20]}"
        if atts:
            lbl += f"  ✅{ok}/{len(atts)}"
        rows.append([InlineKeyboardButton(text=lbl, callback_data=f"lesson:{l.id}:{group_id}")])

    rows.append([InlineKeyboardButton(text="➕ Yangi dars qo'shish", callback_data=f"newlesson:{group_id}")])
    rows.append([InlineKeyboardButton(text="⬅️ Orqaga", callback_data="back:groups")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def kb_attendance(students, att_data: dict, lesson_id: int):
    ICON = {"present": "✅", "absent": "❌", "excused": "🟡"}
    NEXT = {"present": "absent", "absent": "excused", "excused": "present"}

    rows = []
    for sg in students:
        stu    = sg.student
        status = att_data.get(str(sg.student_id), "present")
        icon   = ICON.get(status, "✅")
        name   = (stu.full_name if stu else f"#{sg.student_id}")[:22]
        rows.append([InlineKeyboardButton(
            text=f"{icon} {name}",
            callback_data=f"toggle:{lesson_id}:{sg.student_id}:{NEXT.get(status, 'present')}",
        )])

    present = sum(1 for v in att_data.values() if v == "present")
    absent  = sum(1 for v in att_data.values() if v == "absent")
    excused = sum(1 for v in att_data.values() if v == "excused")

    rows.append([
        InlineKeyboardButton(text="✅ Hammasi keldi",    callback_data=f"allpresent:{lesson_id}"),
        InlineKeyboardButton(text="❌ Hammasi kelmadi",  callback_data=f"allabsent:{lesson_id}"),
    ])
    rows.append([InlineKeyboardButton(
        text=f"💾 Saqlash  ({present}✅ {absent}❌ {excused}🟡)",
        callback_data=f"save:{lesson_id}",
    )])
    rows.append([InlineKeyboardButton(text="⬅️ Orqaga", callback_data="back:groups")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ── Command handlers ──────────────────────────────────────────────
@dp.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "👋 *Assalomu alaykum!*\n\n"
        "Bu StudyFlow davomat tizimi.\n"
        "Telefon raqamingizni yuboring:",
        parse_mode="Markdown",
        reply_markup=kb_phone(),
    )
    await state.set_state(AttFlow.waiting_phone)


@dp.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "📖 *Yordam*\n\n"
        "/start — Botni qayta ishga tushirish\n\n"
        "Davomat tartibi:\n"
        "1️⃣ Telefon raqamingizni yuboring\n"
        "2️⃣ Guruhni tanlang\n"
        "3️⃣ Darsni tanlang yoki yangi qo'shing\n"
        "4️⃣ Talabalar ro'yxatida ✅/❌/🟡 bosing\n"
        "5️⃣ *💾 Saqlash* ni bosing\n\n"
        "✅ Keldi  ❌ Kelmadi  🟡 Sababli",
        parse_mode="Markdown",
    )


# ── Phone input ───────────────────────────────────────────────────
@dp.message(F.contact, AttFlow.waiting_phone)
async def handle_contact(message: Message, state: FSMContext):
    phone = message.contact.phone_number
    if not phone.startswith("+"):
        phone = "+" + phone
    await _resolve_teacher(message, state, phone)


@dp.message(F.text, AttFlow.waiting_phone)
async def handle_phone_text(message: Message, state: FSMContext):
    raw   = message.text.strip()
    clean = raw.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if not clean.startswith("+"):
        clean = "+998" + clean.lstrip("0")
    await _resolve_teacher(message, state, clean)


async def _resolve_teacher(message: Message, state: FSMContext, phone: str):
    teacher = await get_teacher_by_phone(phone)
    if not teacher:
        await message.answer(
            "❌ Bu raqam tizimda topilmadi.\n"
            "To'g'ri format: *+998901234567*\n"
            "Yoki tugmani bosing 👇",
            parse_mode="Markdown",
            reply_markup=kb_phone(),
        )
        return

    groups = await get_teacher_groups(teacher.id)
    await state.update_data(teacher_id=teacher.id, teacher_name=teacher.full_name)

    if not groups:
        await message.answer(
            f"Salom, *{teacher.full_name}!* 👋\n\nSizga guruh biriktirilmagan.\n"
            "Administrator bilan bog'laning.",
            parse_mode="Markdown",
            reply_markup=ReplyKeyboardRemove(),
        )
        return

    await message.answer(
        f"Salom, *{teacher.full_name}!* 👋\n\n"
        f"Sizda *{len(groups)}* ta guruh bor.\nQaysi guruh uchun davomat?",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer("👇 Guruhni tanlang:", reply_markup=kb_groups(groups))
    await state.set_state(AttFlow.choosing_group)


# ── Group selection ───────────────────────────────────────────────
@dp.callback_query(F.data.startswith("group:"))
async def cb_group(call: CallbackQuery, state: FSMContext):
    group_id   = int(call.data.split(":")[1])
    group_name = await get_group_name(group_id)
    await state.update_data(group_id=group_id, group_name=group_name)

    lessons = await get_today_lessons(group_id)
    today_s = date.today().strftime("%d.%m.%Y")

    if lessons:
        text = f"📚 *{group_name}*\n\nBugungi darslar ({today_s}):"
    else:
        text = f"📚 *{group_name}*\n\nBugun ({today_s}) dars topilmadi.\nYangi dars qo'shish mumkin:"

    await call.message.edit_text(text, parse_mode="Markdown",
                                  reply_markup=kb_lessons(lessons, group_id))
    await state.set_state(AttFlow.choosing_lesson)
    await call.answer()


# ── Create new lesson ─────────────────────────────────────────────
@dp.callback_query(F.data.startswith("newlesson:"))
async def cb_new_lesson(call: CallbackQuery, state: FSMContext):
    group_id   = int(call.data.split(":")[1])
    data       = await state.get_data()
    teacher_id = data["teacher_id"]
    group_name = data.get("group_name", await get_group_name(group_id))

    lesson_id, student_count = await create_lesson_for_today(group_id, teacher_id)
    await call.answer("✅ Dars yaratildi!")

    students = await get_group_students(group_id)
    att_data = {str(sg.student_id): "present" for sg in students}
    await state.update_data(lesson_id=lesson_id, att_data=att_data)

    await call.message.edit_text(
        f"📚 *{group_name}* — yangi dars\n"
        f"👥 {student_count} ta talaba\n\n"
        "Holat o'zgartirish uchun talaba nomini bosing:\n"
        "✅ Keldi → ❌ Kelmadi → 🟡 Sababli → ✅ ...",
        parse_mode="Markdown",
        reply_markup=kb_attendance(students, att_data, lesson_id),
    )
    await state.set_state(AttFlow.marking_att)


# ── Existing lesson selected ──────────────────────────────────────
@dp.callback_query(F.data.startswith("lesson:"))
async def cb_lesson(call: CallbackQuery, state: FSMContext):
    parts      = call.data.split(":")
    lesson_id  = int(parts[1])
    group_id   = int(parts[2])
    data       = await state.get_data()
    group_name = data.get("group_name", await get_group_name(group_id))

    students = await get_group_students(group_id)

    # Load existing attendance
    async with AsyncSessionLocal() as db:
        atts = (await db.execute(
            select(Attendance).where(Attendance.lesson_id == lesson_id)
        )).scalars().all()

    att_data = {str(sg.student_id): "present" for sg in students}
    for a in atts:
        att_data[str(a.student_id)] = a.status.value if hasattr(a.status, "value") else str(a.status)

    await state.update_data(lesson_id=lesson_id, att_data=att_data)

    await call.message.edit_text(
        f"📚 *{group_name}*\n"
        f"👥 {len(students)} ta talaba\n\n"
        "Holat o'zgartirish uchun talaba nomini bosing:\n"
        "✅ Keldi → ❌ Kelmadi → 🟡 Sababli → ✅ ...",
        parse_mode="Markdown",
        reply_markup=kb_attendance(students, att_data, lesson_id),
    )
    await state.set_state(AttFlow.marking_att)
    await call.answer()


# ── Toggle individual student ─────────────────────────────────────
@dp.callback_query(F.data.startswith("toggle:"))
async def cb_toggle(call: CallbackQuery, state: FSMContext):
    _, lesson_id_s, student_id_s, new_status = call.data.split(":")
    lesson_id = int(lesson_id_s)

    data     = await state.get_data()
    att_data = data.get("att_data", {})
    group_id = data.get("group_id")

    att_data[student_id_s] = new_status
    await state.update_data(att_data=att_data)

    students = await get_group_students(group_id)
    await call.message.edit_reply_markup(
        reply_markup=kb_attendance(students, att_data, lesson_id)
    )
    await call.answer()


# ── Mark all present ──────────────────────────────────────────────
@dp.callback_query(F.data.startswith("allpresent:"))
async def cb_all_present(call: CallbackQuery, state: FSMContext):
    lesson_id = int(call.data.split(":")[1])
    data      = await state.get_data()
    students  = await get_group_students(data["group_id"])
    att_data  = {str(sg.student_id): "present" for sg in students}
    await state.update_data(att_data=att_data)
    await call.message.edit_reply_markup(
        reply_markup=kb_attendance(students, att_data, lesson_id)
    )
    await call.answer("✅ Hammasi keldi deb belgilandi")


# ── Mark all absent ───────────────────────────────────────────────
@dp.callback_query(F.data.startswith("allabsent:"))
async def cb_all_absent(call: CallbackQuery, state: FSMContext):
    lesson_id = int(call.data.split(":")[1])
    data      = await state.get_data()
    students  = await get_group_students(data["group_id"])
    att_data  = {str(sg.student_id): "absent" for sg in students}
    await state.update_data(att_data=att_data)
    await call.message.edit_reply_markup(
        reply_markup=kb_attendance(students, att_data, lesson_id)
    )
    await call.answer("❌ Hammasi kelmadi deb belgilandi")


# ── Save attendance ───────────────────────────────────────────────
@dp.callback_query(F.data.startswith("save:"))
async def cb_save(call: CallbackQuery, state: FSMContext):
    lesson_id  = int(call.data.split(":")[1])
    data       = await state.get_data()
    att_data   = data.get("att_data", {})
    group_name = data.get("group_name", "Guruh")

    await save_attendance(lesson_id, att_data)

    present = sum(1 for v in att_data.values() if v == "present")
    absent  = sum(1 for v in att_data.values() if v == "absent")
    excused = sum(1 for v in att_data.values() if v == "excused")
    total   = len(att_data)
    pct     = round(present / total * 100) if total else 0

    await call.message.edit_text(
        f"✅ *Davomat saqlandi!*\n\n"
        f"📚 {group_name}\n"
        f"📅 {date.today().strftime('%d.%m.%Y')}\n\n"
        f"✅ Keldi:    *{present}* ta\n"
        f"❌ Kelmadi:  *{absent}* ta\n"
        f"🟡 Sababli:  *{excused}* ta\n\n"
        f"📊 Davomat: *{pct}%*",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🔄 Boshqa guruh", callback_data="back:groups"),
        ]]),
    )
    await call.answer("✅ Saqlandi!")


# ── Back to groups ────────────────────────────────────────────────
@dp.callback_query(F.data == "back:groups")
async def cb_back_groups(call: CallbackQuery, state: FSMContext):
    data       = await state.get_data()
    teacher_id = data.get("teacher_id")
    if not teacher_id:
        await call.message.edit_text("Qaytadan /start yuboring.")
        return

    groups       = await get_teacher_groups(teacher_id)
    teacher_name = data.get("teacher_name", "")
    await call.message.edit_text(
        f"Salom, *{teacher_name}!* 👋\nGuruhni tanlang:",
        parse_mode="Markdown",
        reply_markup=kb_groups(groups),
    )
    await state.set_state(AttFlow.choosing_group)
    await call.answer()


# ── Webhook / polling helpers (called from telegram.py) ──────────
async def set_webhook():
    url = settings.TELEGRAM_WEBHOOK_URL
    if url:
        await bot.set_webhook(url)
        log.info(f"Telegram webhook set: {url}")
    else:
        log.warning("TELEGRAM_WEBHOOK_URL not set — bot will not receive updates")


async def process_update(update_data: dict):
    from aiogram.types import Update
    update = Update.model_validate(update_data)
    await dp.feed_update(bot, update)


async def start_polling():
    """Use in development when no public URL is available."""
    log.info("Starting Telegram bot (polling mode)...")
    await dp.start_polling(bot)