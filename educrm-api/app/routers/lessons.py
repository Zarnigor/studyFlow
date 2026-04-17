"""
Lessons & Attendance router — /api/v1/lessons
Role-based access:
  GET  /lessons              — barcha rollar (o'qituvchi faqat o'z guruhlarini)
  POST /lessons              — super_admin, admin, manager (cashier va teacher yarata olmaydi)
  PUT  /lessons/:id          — super_admin, admin, manager, teacher (faqat o'z darsi)
  DELETE /lessons/:id        — super_admin, admin, manager
  POST /lessons/:id/attendance — super_admin, admin, manager, teacher (faqat o'z darsi)
  GET  /lessons/report/*     — barcha rollar (o'qituvchi faqat o'z guruhlarini)
"""
from datetime import date as dt_date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.db.models import (
    Lesson, Attendance, Group, Teacher, Student,
    StudentGroup, User, AttStatus, UserRole,
)
from app.core.security import (
    get_current_user,
    require_lesson_access,
    require_lesson_create,
    require_admin,
)
from app.schemas.schemas import OKResponse, LessonUpdateIn
from app.crud import crud
import structlog

log = structlog.get_logger()
lesson_router = APIRouter(prefix="/lessons", tags=["Lessons & Attendance"])


# ── helpers ─────────────────────────────────────────────────────
def lesson_to_dict(lesson: Lesson) -> dict:
    return {
        "id":           lesson.id,
        "group_id":     lesson.group_id,
        "teacher_id":   lesson.teacher_id,
        "room_id":      lesson.room_id,
        "lesson_date":  str(lesson.lesson_date),
        "start_time":   str(lesson.start_time),
        "end_time":     str(lesson.end_time),
        "topic":        lesson.topic,
        "is_cancelled": lesson.is_cancelled,
        "cancel_reason":lesson.cancel_reason,
        "created_at":   lesson.created_at.isoformat() if lesson.created_at else None,
        "attendances":  [att_to_dict(a) for a in (lesson.attendances or [])],
    }

def att_to_dict(a: Attendance) -> dict:
    return {
        "id":         a.id,
        "lesson_id":  a.lesson_id,
        "student_id": a.student_id,
        "status":     a.status.value if hasattr(a.status, "value") else a.status,
        "note":       a.note,
        "marked_at":  a.marked_at.isoformat() if a.marked_at else None,
    }

async def get_teacher_group_ids(db: AsyncSession, user: User) -> Optional[list[int]]:
    """
    O'qituvchi uchun faqat o'z guruhlarini qaytaradi.
    Admin/manager uchun None (hamma guruhlar).
    """
    if user.role == UserRole.teacher:
        teacher = (await db.execute(
            select(Teacher).where(Teacher.user_id == user.id)
        )).scalar_one_or_none()
        if not teacher:
            return []
        groups = (await db.execute(
            select(Group.id).where(Group.teacher_id == teacher.id, Group.is_active == True)
        )).scalars().all()
        return list(groups)
    return None  # None = hamma guruhlar

async def can_modify_lesson(db: AsyncSession, lesson_id: int, user: User) -> Lesson:
    """
    O'qituvchi faqat o'z guruhidagi darsni o'zgartira oladi.
    Admin/manager istalgan darsni.
    """
    lesson = (await db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(404, "Dars topilmadi")

    if user.role == UserRole.teacher:
        allowed_ids = await get_teacher_group_ids(db, user)
        if lesson.group_id not in (allowed_ids or []):
            raise HTTPException(403, "Siz faqat o'z guruhingiz darsini o'zgartira olasiz")

    return lesson


# ── GET /lessons ────────────────────────────────────────────────
@lesson_router.get("")
async def list_lessons(
    group_id:  Optional[int] = None,
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    limit:     int = Query(default=50, ge=1, le=200),
    db:        AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_group_ids = await get_teacher_group_ids(db, current_user)

    q = (
        select(Lesson)
        .options(selectinload(Lesson.attendances))
        .order_by(Lesson.lesson_date.desc(), Lesson.start_time.desc())
    )

    # O'qituvchi faqat o'z guruhlarini ko'radi
    if allowed_group_ids is not None:
        if not allowed_group_ids:
            return {"success": True, "data": []}
        if group_id and group_id in allowed_group_ids:
            q = q.where(Lesson.group_id == group_id)
        else:
            q = q.where(Lesson.group_id.in_(allowed_group_ids))
    elif group_id:
        q = q.where(Lesson.group_id == group_id)

    if date_from:
        try: q = q.where(Lesson.lesson_date >= dt_date.fromisoformat(date_from))
        except ValueError: pass
    if date_to:
        try: q = q.where(Lesson.lesson_date <= dt_date.fromisoformat(date_to))
        except ValueError: pass

    lessons = (await db.execute(q.limit(limit))).scalars().all()
    return {"success": True, "data": [lesson_to_dict(l) for l in lessons]}


# ── POST /lessons ────────────────────────────────────────────────
@lesson_router.post("", status_code=201)
async def create_lesson(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lesson_create),
):
    body = await request.json()

    group_id    = body.get("group_id")
    lesson_date = body.get("lesson_date")
    start_time  = body.get("start_time")
    end_time    = body.get("end_time", start_time)
    topic       = body.get("topic")
    teacher_id  = body.get("teacher_id")

    if not group_id or not lesson_date or not start_time:
        raise HTTPException(400, "group_id, lesson_date va start_time shart")

    # Parse date
    try:
        if isinstance(lesson_date, str):
            lesson_date_parsed = dt_date.fromisoformat(lesson_date)
        else:
            lesson_date_parsed = lesson_date
    except ValueError:
        raise HTTPException(400, f"lesson_date format xato: {lesson_date}. YYYY-MM-DD bo'lishi kerak")

    # Get group
    group = (await db.execute(
        select(Group).where(Group.id == group_id)
    )).scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Guruh topilmadi")

    # Resolve teacher: use provided id, fall back to group's teacher
    if not teacher_id:
        teacher_id = group.teacher_id
    if not teacher_id:
        raise HTTPException(
            status_code=400,
            detail="Guruhga o'qituvchi biriktirilmagan. Guruhlar bo'limida avval o'qituvchi biriktiring.",
        )

    # Normalize time strings
    def fix_time(t):
        if not t: return "10:00:00"
        parts = str(t).split(":")
        if len(parts) == 2: return f"{t}:00"
        return t

    lesson = Lesson(
        group_id    = group_id,
        teacher_id  = teacher_id,
        lesson_date = lesson_date_parsed,
        start_time  = fix_time(start_time),
        end_time    = fix_time(end_time),
        topic       = topic,
    )
    db.add(lesson)
    await db.flush()
    await db.refresh(lesson)

    # Auto-create attendance for all active students
    sg_rows = (await db.execute(
        select(StudentGroup).where(
            StudentGroup.group_id == group_id,
            StudentGroup.is_active == True,
        )
    )).scalars().all()

    for sg in sg_rows:
        db.add(Attendance(
            lesson_id  = lesson.id,
            student_id = sg.student_id,
            status     = AttStatus.present,
            marked_by  = current_user.id,
        ))

    await db.flush()

    result = (await db.execute(
        select(Lesson).where(Lesson.id == lesson.id)
        .options(selectinload(Lesson.attendances))
    )).scalar_one()

    return {"success": True, "data": lesson_to_dict(result)}


# ── GET /lessons/report/attendance ───────────────────────────────
@lesson_router.get("/report/attendance")
async def attendance_report(
    group_id: int = Query(...),
    month:    int = Query(..., ge=1, le=12),
    year:     int = Query(..., ge=2020),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # O'qituvchi faqat o'z guruhining hisobotini ko'ra oladi
    if current_user.role == UserRole.teacher:
        allowed = await get_teacher_group_ids(db, current_user)
        if group_id not in (allowed or []):
            raise HTTPException(403, "Bu guruh hisobotiga ruxsatingiz yo'q")

    data = await crud.get_attendance_report(db, group_id, month, year)
    return {"success": True, "data": data}


# ── GET /lessons/stats/by-group ──────────────────────────────────
@lesson_router.get("/stats/by-group")
async def lessons_stats(
    group_id:   Optional[int] = None,
    branch_id:  Optional[int] = None,
    month:      Optional[int] = None,
    year:       Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # O'qituvchi faqat o'z guruhlarini
    allowed_ids = await get_teacher_group_ids(db, current_user)

    q = (
        select(
            Group.id.label("group_id"),
            Group.name.label("group_name"),
            func.count(Lesson.id).label("total_lessons"),
            func.count(Attendance.id).label("total_att"),
            func.count(Attendance.id).filter(
                Attendance.status == AttStatus.present
            ).label("present_count"),
        )
        .join(Lesson,     Lesson.group_id     == Group.id)
        .join(Attendance, Attendance.lesson_id == Lesson.id)
        .group_by(Group.id, Group.name)
    )

    if allowed_ids is not None:
        if not allowed_ids:
            return {"success": True, "data": []}
        q = q.where(Group.id.in_(allowed_ids))
    else:
        if group_id:  q = q.where(Group.id == group_id)
        if branch_id: q = q.where(Group.branch_id == branch_id)

    if month: q = q.where(func.extract("month", Lesson.lesson_date) == month)
    if year:  q = q.where(func.extract("year",  Lesson.lesson_date) == year)

    rows = (await db.execute(q)).all()
    return {
        "success": True,
        "data": [
            {
                "group_id":      r.group_id,
                "group_name":    r.group_name,
                "total_lessons": r.total_lessons,
                "total_students":r.total_att,
                "present":       r.present_count,
                "pct": round(r.present_count / r.total_att * 100, 1) if r.total_att else 0,
            }
            for r in rows
        ],
    }


# ── GET /lessons/:id ────────────────────────────────────────────
@lesson_router.get("/{lesson_id}")
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson = (await db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
        .options(selectinload(Lesson.attendances))
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(404, "Dars topilmadi")

    # O'qituvchi faqat o'z darsini ko'radi
    if current_user.role == UserRole.teacher:
        allowed = await get_teacher_group_ids(db, current_user)
        if lesson.group_id not in (allowed or []):
            raise HTTPException(403, "Bu darsga ruxsatingiz yo'q")

    return {"success": True, "data": lesson_to_dict(lesson)}


# ── PUT /lessons/:id ─────────────────────────────────────────────
@lesson_router.put("/{lesson_id}")
async def update_lesson(
    lesson_id: int,
    body: LessonUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lesson_access),
):
    lesson = await can_modify_lesson(db, lesson_id, current_user)

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(lesson, k, v)
    await db.flush()

    log.info("Lesson updated", lesson_id=lesson_id, by=current_user.id, role=current_user.role)
    return {"success": True, "data": lesson_to_dict(lesson)}


# ── DELETE /lessons/:id ──────────────────────────────────────────
@lesson_router.delete("/{lesson_id}", response_model=OKResponse)
async def delete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lesson_create),   # o'qituvchi o'chira olmaydi
):
    lesson = (await db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
    )).scalar_one_or_none()
    if not lesson:
        raise HTTPException(404, "Dars topilmadi")
    await db.delete(lesson)
    log.info("Lesson deleted", lesson_id=lesson_id, by=current_user.id)
    return OKResponse(message="Dars o'chirildi")


# ── POST /lessons/:id/attendance ─────────────────────────────────
@lesson_router.post("/{lesson_id}/attendance")
async def mark_attendance(
    lesson_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_lesson_access),   # teacher ham belgilay oladi
):
    lesson = await can_modify_lesson(db, lesson_id, current_user)
    entries = body.get("entries", [])

    result = []
    for entry in entries:
        student_id = entry.get("student_id")
        status_raw = entry.get("status", "present")
        note       = entry.get("note")

        if not student_id:
            continue

        try:
            status_val = AttStatus(status_raw)
        except ValueError:
            status_val = AttStatus.present

        existing = (await db.execute(
            select(Attendance).where(
                Attendance.lesson_id  == lesson_id,
                Attendance.student_id == student_id,
            )
        )).scalar_one_or_none()

        if existing:
            existing.status    = status_val
            existing.note      = note
            existing.marked_by = current_user.id
            result.append(existing)
        else:
            att = Attendance(
                lesson_id  = lesson_id,
                student_id = student_id,
                status     = status_val,
                note       = note,
                marked_by  = current_user.id,
            )
            db.add(att)
            result.append(att)

    await db.flush()

    log.info("Attendance marked", lesson_id=lesson_id, count=len(result),
             by=current_user.id, role=current_user.role)

    return {"success": True, "data": [att_to_dict(a) for a in result]}
