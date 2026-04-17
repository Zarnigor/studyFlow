from typing import Optional, Sequence
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, and_, or_
from sqlalchemy.orm import selectinload
from app.db.models import (
    Branch, User, Subject, Teacher, Group, Student, StudentGroup,
    Payment, Lesson, Attendance, Lead, LeadHistory, SalaryPayment,
    UserRole, StudentStatus, PaymentStatus, PaymentMethod,
    AttStatus, LeadStage
)
from app.core.security import hash_password
import structlog, secrets, string

log = structlog.get_logger()


def _receipt_no() -> str:
    chars = string.ascii_uppercase + string.digits
    rand  = "".join(secrets.choice(chars) for _ in range(6))
    today = datetime.now().strftime("%Y%m%d")
    return f"REC-{today}-{rand}"


# ── Branch ────────────────────────────────────────────────────
async def create_branch(db: AsyncSession, data: dict) -> Branch:
    obj = Branch(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_branches(db: AsyncSession, active_only: bool = True) -> Sequence[Branch]:
    q = select(Branch)
    if active_only: q = q.where(Branch.is_active == True)
    return (await db.execute(q.order_by(Branch.id))).scalars().all()

async def get_branch(db: AsyncSession, branch_id: int) -> Optional[Branch]:
    return (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()

async def update_branch(db: AsyncSession, branch_id: int, data: dict) -> Optional[Branch]:
    await db.execute(update(Branch).where(Branch.id == branch_id).values(**{k:v for k,v in data.items() if v is not None}))
    return await get_branch(db, branch_id)


# ── User / Auth ───────────────────────────────────────────────
async def get_user_by_phone(db: AsyncSession, phone: str) -> Optional[User]:
    return (await db.execute(select(User).where(User.phone == phone))).scalar_one_or_none()

async def create_user(db: AsyncSession, data: dict) -> User:
    data["password_hash"] = hash_password(data.pop("password"))
    obj = User(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_users(db: AsyncSession, branch_id: Optional[int] = None) -> Sequence[User]:
    q = select(User)
    if branch_id: q = q.where(User.branch_id == branch_id)
    return (await db.execute(q.order_by(User.id))).scalars().all()

async def update_user(db: AsyncSession, user_id: int, data: dict) -> Optional[User]:
    await db.execute(update(User).where(User.id == user_id).values(**{k:v for k,v in data.items() if v is not None}))
    return (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()

async def record_login(db: AsyncSession, user_id: int):
    await db.execute(update(User).where(User.id == user_id).values(last_login=datetime.now(timezone.utc)))


# ── Subject ───────────────────────────────────────────────────
async def get_subjects(db: AsyncSession) -> Sequence[Subject]:
    return (await db.execute(select(Subject).order_by(Subject.id))).scalars().all()

async def create_subject(db: AsyncSession, data: dict) -> Subject:
    obj = Subject(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj


# ── Teacher ───────────────────────────────────────────────────
async def create_teacher(db: AsyncSession, data: dict) -> Teacher:
    obj = Teacher(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_teachers(db: AsyncSession, branch_id: Optional[int] = None, active_only: bool = True) -> Sequence[Teacher]:
    q = select(Teacher).options(
        selectinload(Teacher.groups).selectinload(Group.student_groups)
    )
    if branch_id:   q = q.where(Teacher.branch_id == branch_id)
    if active_only: q = q.where(Teacher.is_active == True)
    return (await db.execute(q.order_by(Teacher.full_name))).scalars().all()

async def get_teacher(db: AsyncSession, teacher_id: int) -> Optional[Teacher]:
    return (await db.execute(
        select(Teacher).where(Teacher.id == teacher_id)
        .options(selectinload(Teacher.groups).selectinload(Group.student_groups))
    )).scalar_one_or_none()

async def update_teacher(db: AsyncSession, teacher_id: int, data: dict) -> Optional[Teacher]:
    await db.execute(update(Teacher).where(Teacher.id == teacher_id).values(**{k:v for k,v in data.items() if v is not None}))
    return await get_teacher(db, teacher_id)


# ── Group ─────────────────────────────────────────────────────
async def create_group(db: AsyncSession, data: dict) -> Group:
    obj = Group(**data)
    db.add(obj)
    await db.flush()
    return await get_group(db, obj.id)

async def get_groups(db: AsyncSession, branch_id: Optional[int] = None, active_only: bool = True) -> Sequence[Group]:
    q = select(Group).options(
        selectinload(Group.teacher),
        selectinload(Group.student_groups),
    )
    if branch_id:   q = q.where(Group.branch_id == branch_id)
    if active_only: q = q.where(Group.is_active == True)
    return (await db.execute(q.order_by(Group.name))).scalars().all()

async def get_group(db: AsyncSession, group_id: int) -> Optional[Group]:
    return (await db.execute(
        select(Group).where(Group.id == group_id)
        .options(
            selectinload(Group.teacher),
            selectinload(Group.student_groups).selectinload(StudentGroup.student),
        )
    )).scalar_one_or_none()

async def update_group(db: AsyncSession, group_id: int, data: dict) -> Optional[Group]:
    await db.execute(update(Group).where(Group.id == group_id).values(**{k:v for k,v in data.items() if v is not None}))
    return await get_group(db, group_id)

async def count_group_students(db: AsyncSession, group_id: int) -> int:
    r = await db.execute(select(func.count()).where(StudentGroup.group_id == group_id, StudentGroup.is_active == True))
    return r.scalar() or 0

async def add_student_to_group(db: AsyncSession, student_id: int, group_id: int) -> StudentGroup:
    # Check duplicate
    existing = (await db.execute(
        select(StudentGroup).where(StudentGroup.student_id == student_id, StudentGroup.group_id == group_id)
    )).scalar_one_or_none()
    if existing:
        existing.is_active = True
        existing.left_at   = None
        return existing
    obj = StudentGroup(student_id=student_id, group_id=group_id)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def remove_student_from_group(db: AsyncSession, student_id: int, group_id: int):
    await db.execute(
        update(StudentGroup)
        .where(StudentGroup.student_id == student_id, StudentGroup.group_id == group_id)
        .values(is_active=False, left_at=date.today())
    )


# ── Student ───────────────────────────────────────────────────
async def create_student(db: AsyncSession, data: dict) -> Student:
    from app.db.models import LeadSource, LeadStage
    obj = Student(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    # If student is 'new', mirror them into Leads so Applications page stays in sync
    if obj.status == StudentStatus.new:
        existing_lead = (await db.execute(
            select(Lead).where(Lead.phone == obj.phone)
        )).scalar_one_or_none()
        if not existing_lead:
            lead = Lead(
                branch_id=obj.branch_id,
                full_name=obj.full_name,
                phone=obj.phone,
                stage=LeadStage.new,
                source=LeadSource.other,
                notes=f"student_id:{obj.id}",
            )
            db.add(lead)
            await db.flush()
    return obj

async def get_students(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    status:    Optional[StudentStatus] = None,
    q:         Optional[str] = None,
    page:      int = 1,
    limit:     int = 20,
) -> tuple[Sequence[Student], int]:
    base = select(Student)
    if branch_id: base = base.where(Student.branch_id == branch_id)
    if status:    base = base.where(Student.status == status)
    if q:
        like = f"%{q}%"
        base = base.where(or_(Student.full_name.ilike(like), Student.phone.ilike(like)))

    total  = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    result = (await db.execute(base.order_by(Student.full_name).offset((page-1)*limit).limit(limit))).scalars().all()
    return result, total

async def get_student(db: AsyncSession, student_id: int) -> Optional[Student]:
    return (await db.execute(
        select(Student).where(Student.id == student_id)
        .options(
            selectinload(Student.student_groups).selectinload(StudentGroup.group),
            selectinload(Student.payments),
        )
    )).scalar_one_or_none()

async def update_student(db: AsyncSession, student_id: int, data: dict) -> Optional[Student]:
    await db.execute(update(Student).where(Student.id == student_id).values(**{k:v for k,v in data.items() if v is not None}))
    student = await get_student(db, student_id)
    # Sync lead stage when student becomes active
    new_status = data.get("status")
    if new_status == StudentStatus.active or new_status == "active":
        lead = (await db.execute(
            select(Lead)
            .where(Lead.phone == student.phone, Lead.stage != LeadStage.enrolled)
            .order_by(Lead.created_at.desc())
        )).scalar_one_or_none()
        if lead:
            lead.stage = LeadStage.enrolled
            lead.converted_student_id = student_id
            await db.flush()
    return student


# ── Payment ───────────────────────────────────────────────────
async def create_payment(db: AsyncSession, data: dict, created_by: int) -> Payment:
    data["receipt_no"] = _receipt_no()
    data["created_by"] = created_by
    if data.get("status") == PaymentStatus.paid:
        data["paid_at"] = datetime.now(timezone.utc)
    obj = Payment(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_payments(
    db: AsyncSession,
    branch_id:    Optional[int] = None,
    student_id:   Optional[int] = None,
    status:       Optional[PaymentStatus] = None,
    period_month: Optional[int] = None,
    period_year:  Optional[int] = None,
    page:  int = 1,
    limit: int = 20,
) -> tuple[list, int]:
    q = select(Payment, Student.full_name.label("student_name")).join(Student, Student.id == Payment.student_id)
    if branch_id:    q = q.where(Payment.branch_id == branch_id)
    if student_id:   q = q.where(Payment.student_id == student_id)
    if status:       q = q.where(Payment.status == status)
    if period_month: q = q.where(Payment.period_month == period_month)
    if period_year:  q = q.where(Payment.period_year == period_year)

    total  = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows   = (await db.execute(q.order_by(Payment.created_at.desc()).offset((page-1)*limit).limit(limit))).all()
    result = []
    for row in rows:
        p = row.Payment
        p.student_name = row.student_name  # type: ignore
        result.append(p)
    return result, total

async def get_payment(db: AsyncSession, payment_id: int) -> Optional[Payment]:
    return (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one_or_none()

async def update_payment(db: AsyncSession, payment_id: int, data: dict) -> Optional[Payment]:
    if data.get("status") == PaymentStatus.paid and "paid_at" not in data:
        data["paid_at"] = datetime.now(timezone.utc)
    await db.execute(update(Payment).where(Payment.id == payment_id).values(**{k:v for k,v in data.items() if v is not None}))
    return await get_payment(db, payment_id)

async def bulk_generate_payments(db: AsyncSession, branch_id: int, month: int, year: int, created_by: int) -> int:
    """Auto-generate pending payments for all active students in active groups."""
    sg_query = (
        select(StudentGroup.student_id, Group.id.label("group_id"), Group.monthly_fee)
        .join(Group, Group.id == StudentGroup.group_id)
        .where(StudentGroup.is_active == True, Group.is_active == True, Group.branch_id == branch_id)
    )
    rows = (await db.execute(sg_query)).all()
    count = 0
    for row in rows:
        exists = (await db.execute(
            select(Payment.id).where(
                Payment.student_id == row.student_id,
                Payment.group_id   == row.group_id,
                Payment.period_month == month,
                Payment.period_year  == year,
            )
        )).scalar_one_or_none()
        if not exists:
            p = Payment(
                branch_id=branch_id, student_id=row.student_id, group_id=row.group_id,
                amount=row.monthly_fee, discount=0, method=PaymentMethod.cash,
                status=PaymentStatus.pending, period_month=month, period_year=year,
                created_by=created_by, receipt_no=_receipt_no(),
            )
            db.add(p)
            count += 1
    await db.flush()
    return count


# ── Lesson / Attendance ───────────────────────────────────────
async def create_lesson(db: AsyncSession, data: dict) -> Lesson:
    obj = Lesson(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_lessons(db: AsyncSession, group_id: Optional[int] = None, date_from: Optional[date] = None, date_to: Optional[date] = None) -> Sequence[Lesson]:
    q = select(Lesson)
    if group_id:  q = q.where(Lesson.group_id == group_id)
    if date_from: q = q.where(Lesson.lesson_date >= date_from)
    if date_to:   q = q.where(Lesson.lesson_date <= date_to)
    return (await db.execute(q.order_by(Lesson.lesson_date.desc()))).scalars().all()

async def get_lesson(db: AsyncSession, lesson_id: int) -> Optional[Lesson]:
    return (await db.execute(
        select(Lesson).where(Lesson.id == lesson_id)
        .options(selectinload(Lesson.attendances))
    )).scalar_one_or_none()

async def bulk_mark_attendance(db: AsyncSession, lesson_id: int, entries: list[dict], marked_by: int) -> list[Attendance]:
    result = []
    for entry in entries:
        existing = (await db.execute(
            select(Attendance).where(Attendance.lesson_id == lesson_id, Attendance.student_id == entry["student_id"])
        )).scalar_one_or_none()
        if existing:
            existing.status    = entry["status"]
            existing.note      = entry.get("note")
            existing.marked_by = marked_by
            result.append(existing)
        else:
            att = Attendance(lesson_id=lesson_id, marked_by=marked_by, **entry)
            db.add(att)
            result.append(att)
    await db.flush()
    return result

async def get_attendance_report(db: AsyncSession, group_id: int, month: int, year: int) -> list[dict]:
    q = (
        select(
            Student.id, Student.full_name,
            func.count(Attendance.id).label("total"),
            func.count(Attendance.id).filter(Attendance.status == AttStatus.present).label("present"),
            func.count(Attendance.id).filter(Attendance.status == AttStatus.absent).label("absent"),
            func.count(Attendance.id).filter(Attendance.status == AttStatus.excused).label("excused"),
        )
        .join(Attendance, Attendance.student_id == Student.id)
        .join(Lesson, and_(Lesson.id == Attendance.lesson_id, Lesson.group_id == group_id,
                           func.extract("month", Lesson.lesson_date) == month,
                           func.extract("year",  Lesson.lesson_date) == year))
        .group_by(Student.id, Student.full_name)
        .order_by(Student.full_name)
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "student_id": r.id, "full_name": r.full_name,
            "total": r.total, "present": r.present,
            "absent": r.absent, "excused": r.excused,
            "pct": round(r.present / r.total * 100, 1) if r.total else 0,
        }
        for r in rows
    ]


# ── Lead ──────────────────────────────────────────────────────
async def create_lead(db: AsyncSession, data: dict) -> Lead:
    obj = Lead(**data)
    db.add(obj); await db.flush(); await db.refresh(obj)
    return obj

async def get_leads(
    db: AsyncSession,
    branch_id: Optional[int] = None,
    stage:     Optional[LeadStage] = None,
    q:         Optional[str] = None,
    page:  int = 1,
    limit: int = 20,
) -> tuple[Sequence[Lead], int]:
    base = select(Lead)
    if branch_id: base = base.where(Lead.branch_id == branch_id)
    if stage:     base = base.where(Lead.stage == stage)
    if q:
        like = f"%{q}%"
        base = base.where(or_(Lead.full_name.ilike(like), Lead.phone.ilike(like)))
    total  = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    result = (await db.execute(base.order_by(Lead.created_at.desc()).offset((page-1)*limit).limit(limit))).scalars().all()
    return result, total

async def get_lead(db: AsyncSession, lead_id: int) -> Optional[Lead]:
    return (await db.execute(
        select(Lead).where(Lead.id == lead_id)
        .options(selectinload(Lead.history))
    )).scalar_one_or_none()

async def update_lead(db: AsyncSession, lead_id: int, data: dict, changed_by: int) -> Optional[Lead]:
    lead = await get_lead(db, lead_id)
    if not lead: return None
    old_stage = lead.stage
    for k, v in data.items():
        if v is not None: setattr(lead, k, v)
    if "stage" in data and data["stage"] != old_stage:
        hist = LeadHistory(lead_id=lead_id, changed_by=changed_by, from_stage=old_stage, to_stage=data["stage"])
        db.add(hist)
    await db.flush()
    return lead

async def convert_lead(db: AsyncSession, lead: Lead, group_id: Optional[int], created_by: int) -> Student:
    student = Student(
        branch_id=lead.branch_id, full_name=lead.full_name, phone=lead.phone,
        status=StudentStatus.active, referral_source=lead.source.value,
        notes=f"Lead #{lead.id} dan o'tkazildi",
    )
    db.add(student)
    await db.flush()
    if group_id:
        await add_student_to_group(db, student.id, group_id)
    lead.stage = LeadStage.enrolled
    lead.converted_student_id = student.id
    hist = LeadHistory(lead_id=lead.id, changed_by=created_by, from_stage=lead.stage, to_stage=LeadStage.enrolled)
    db.add(hist)
    await db.flush()
    return student

async def get_lead_funnel(db: AsyncSession, branch_id: Optional[int] = None) -> list[dict]:
    q = select(Lead.stage, func.count(Lead.id).label("count"))
    if branch_id: q = q.where(Lead.branch_id == branch_id)
    q = q.group_by(Lead.stage)
    rows  = (await db.execute(q)).all()
    total = sum(r.count for r in rows)
    return [{"stage": r.stage, "count": r.count, "pct": round(r.count/total*100, 1) if total else 0} for r in rows]


# ── Dashboard ─────────────────────────────────────────────────
async def get_dashboard_data(db: AsyncSession, branch_id: Optional[int] = None) -> dict:
    now   = datetime.now()
    month = now.month
    year  = now.year
    prev_month = month - 1 if month > 1 else 12
    prev_year  = year if month > 1 else year - 1

    # Student count
    sq = select(func.count(Student.id))
    if branch_id: sq = sq.where(Student.branch_id == branch_id)
    total_students = (await db.execute(sq)).scalar() or 0

    sq2 = select(func.count(Student.id)).where(Student.status == StudentStatus.new)
    if branch_id: sq2 = sq2.where(Student.branch_id == branch_id)
    new_students = (await db.execute(sq2)).scalar() or 0

    # Revenue
    def rev_q(m, y):
        q = select(func.coalesce(func.sum(Payment.amount - Payment.discount), 0)).where(
            Payment.status == PaymentStatus.paid,
            Payment.period_month == m, Payment.period_year == y,
        )
        if branch_id: q = q.where(Payment.branch_id == branch_id)
        return q

    curr_rev = Decimal((await db.execute(rev_q(month, year))).scalar() or 0)
    prev_rev = Decimal((await db.execute(rev_q(prev_month, prev_year))).scalar() or 0)

    # Groups
    gq = select(func.count(Group.id)).where(Group.is_active == True)
    if branch_id: gq = gq.where(Group.branch_id == branch_id)
    active_groups = (await db.execute(gq)).scalar() or 0

    # Debtors
    dq = select(func.count(func.distinct(Payment.student_id))).where(Payment.status == PaymentStatus.debt)
    if branch_id: dq = dq.where(Payment.branch_id == branch_id)
    debtors = (await db.execute(dq)).scalar() or 0

    # O'tgan 12 oyning revenue trendi (joriy oydan orqaga)
    trend = []
    current_month_start = datetime(year, month, 1)
    for i in range(11, -1, -1):
        d     = current_month_start - relativedelta(months=i)
        m_val = d.month
        y_val = d.year
        rev   = Decimal((await db.execute(rev_q(m_val, y_val))).scalar() or 0)
        trend.append({"month": m_val, "year": y_val, "revenue": float(rev), "target": float(rev * Decimal("1.1"))})

    # Student by group
    gbq = (
        select(Group.name, func.count(StudentGroup.student_id).label("cnt"))
        .join(StudentGroup, StudentGroup.group_id == Group.id)
        .where(StudentGroup.is_active == True, Group.is_active == True)
    )
    if branch_id: gbq = gbq.where(Group.branch_id == branch_id)
    gbq = gbq.group_by(Group.name)
    by_group = [{"name": r.name, "count": r.cnt} for r in (await db.execute(gbq)).all()]

    # Recent payments
    rpq = (
        select(Payment, Student.full_name.label("student_name"))
        .join(Student, Student.id == Payment.student_id)
        .where(Payment.status.in_([PaymentStatus.paid, PaymentStatus.debt]))
    )
    if branch_id: rpq = rpq.where(Payment.branch_id == branch_id)
    rpq = rpq.order_by(Payment.created_at.desc()).limit(5)
    rp_rows = (await db.execute(rpq)).all()
    recent = []
    for row in rp_rows:
        p = row.Payment
        recent.append({
            "id": p.id,
            "student_id": p.student_id,
            "student_name": row.student_name,
            "amount": float(p.amount),
            "discount": float(p.discount),
            "method": p.method.value if p.method else None,
            "status": p.status.value if p.status else None,
            "period_month": p.period_month,
            "period_year": p.period_year,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {
        "kpi": {"total_students": total_students, "new_students": new_students,
                "monthly_revenue": float(curr_rev), "prev_revenue": float(prev_rev),
                "active_groups": active_groups, "debtors": debtors},
        "revenue_trend":    trend,
        "student_by_group": by_group,
        "recent_payments":  recent,
        "alerts": [
            f"{debtors} ta talaba to'lov qilmagan" if debtors else "Barcha to'lovlar amalga oshirilgan",
        ],
    }
