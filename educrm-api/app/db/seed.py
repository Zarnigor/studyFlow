"""
python -m app.db.seed
Ma'lumotlar bazasini namuna ma'lumotlar bilan to'ldiradi.
"""
import asyncio
from datetime import date, time, timedelta
from decimal import Decimal
import random
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
from app.db.models import (
    Branch, User, Subject, Teacher, Room, Group,
    Student, StudentGroup, Payment, Lesson, Attendance, Lead,
    UserRole, StudentStatus, SalaryType, PaymentStatus, PaymentMethod,
    AttStatus, LeadStage, LeadSource,
)
from app.core.security import hash_password
import structlog

log = structlog.get_logger()


async def seed():
    async with AsyncSessionLocal() as db:
        # ── Check if already seeded ────────────────────────────
        count = (await db.execute(text("SELECT COUNT(*) FROM branches"))).scalar()
        if count > 0:
            log.info("DB already seeded, skipping")
            return

        log.info("Seeding database...")

        # ── Branches ───────────────────────────────────────────
        branches = [
            Branch(name="Filial 1 — Chilonzor", address="Chilonzor ko'chasi 5", phone="+998711234567", city="Toshkent"),
            Branch(name="Filial 2 — Yunusobod",  address="Amir Temur 108",       phone="+998712345678", city="Toshkent"),
            Branch(name="Filial 3 — MU",         address="MU ko'chasi 22",        phone="+998713456789", city="Toshkent"),
        ]
        for b in branches: db.add(b)
        await db.flush()
        b1, b2, b3 = branches

        # ── Users ──────────────────────────────────────────────
        super_admin = User(
            full_name="Super Admin", phone="+998900000001",
            password_hash=hash_password("admin123"),
            role=UserRole.super_admin, branch_id=None,
        )
        db.add(super_admin)

        admins = [
            User(full_name=f"Admin {i+1}", phone=f"+99890000000{i+2}",
                 password_hash=hash_password("admin123"),
                 role=UserRole.admin, branch_id=br.id)
            for i, br in enumerate(branches)
        ]
        for a in admins: db.add(a)
        await db.flush()

        # ── Subjects ───────────────────────────────────────────
        subjects_data = [
            ("English",     "#378ADD"),
            ("IELTS",       "#BA7517"),
            ("Mathematics", "#7F77DD"),
            ("Russian",     "#639922"),
            ("IT Basics",   "#1D9E75"),
        ]
        subjects = [Subject(name=n, color=c) for n, c in subjects_data]
        for s in subjects: db.add(s)
        await db.flush()
        s_en, s_ielts, s_math, s_ru, s_it = subjects

        # ── Rooms ──────────────────────────────────────────────
        for br in branches:
            for i in range(1, 4):
                db.add(Room(branch_id=br.id, name=f"Xona {i}", capacity=20))
        await db.flush()

        # ── Teachers ───────────────────────────────────────────
        teachers_raw = [
            ("Kamola Yusupova",  "+998912345678", b1.id, s_en.id,    SalaryType.percent, 30, 4.8),
            ("Otabek Sultonov",  "+998934567890", b1.id, s_ielts.id, SalaryType.percent, 25, 4.6),
            ("Zulfiya Nazarova", "+998901234567", b2.id, s_math.id,  SalaryType.fixed,   3500000, 4.9),
            ("Natasha Ivanova",  "+998976543210", b2.id, s_ru.id,    SalaryType.percent, 28, 4.4),
            ("Bobur Toshmatov",  "+998997654321", b3.id, s_it.id,    SalaryType.percent, 30, 4.7),
        ]
        teachers = [
            Teacher(full_name=n, phone=p, branch_id=bid, subject_id=sid,
                    salary_type=st, salary_value=Decimal(str(sv)), rating=Decimal(str(r)))
            for n, p, bid, sid, st, sv, r in teachers_raw
        ]
        for t in teachers: db.add(t)
        await db.flush()
        t_kamola, t_otabek, t_zulfiya, t_natasha, t_bobur = teachers

        # ── Groups ─────────────────────────────────────────────
        today = date.today()
        groups_raw = [
            ("English Starter", b1.id, t_kamola.id, s_en.id,    20, 500000, {"days":["mon","wed","fri"],"time":"10:00"}),
            ("English B1",      b1.id, t_kamola.id, s_en.id,    25, 600000, {"days":["tue","thu","sat"],"time":"14:00"}),
            ("IELTS Prep",      b1.id, t_otabek.id, s_ielts.id, 15, 800000, {"days":["mon","wed"],     "time":"16:00"}),
            ("Math Advanced",   b2.id, t_zulfiya.id,s_math.id,  20, 550000, {"days":["tue","thu"],     "time":"15:00"}),
            ("Russian A1",      b2.id, t_natasha.id,s_ru.id,    15, 450000, {"days":["fri","sat"],     "time":"11:00"}),
            ("IT Basics",       b3.id, t_bobur.id,  s_it.id,    20, 500000, {"days":["mon","wed","fri"],"time":"09:00"}),
        ]
        groups = [
            Group(name=n, branch_id=bid, teacher_id=tid, subject_id=sid,
                  capacity=cap, monthly_fee=Decimal(str(fee)), schedule=sch,
                  start_date=today - timedelta(days=90), is_active=True)
            for n, bid, tid, sid, cap, fee, sch in groups_raw
        ]
        for g in groups: db.add(g)
        await db.flush()

        # ── Students ───────────────────────────────────────────
        NAMES = [
            "Dilnoza Yusupova", "Jasur Qodirov",    "Malika Razzaqova",
            "Sherzod Toshmatov","Nodira Xasanova",  "Bobur Mirzayev",
            "Zilola Ergasheva", "Husan Nazarov",    "Sarvinoz Tursunova",
            "Otabek Karimov",   "Gulnora Nazarova", "Farrux Mirzaev",
            "Mohira Karimova",  "Behruz Saidov",    "Lola Rashidova",
            "Timur Xoliqov",    "Barno Azimova",    "Firdavs Hamidov",
            "Zuhra Normatova",  "Akbar Salimov",
        ]
        phones = [f"+9989{str(i+1).zfill(8)}" for i in range(len(NAMES))]

        students = []
        branch_cycle = [b1, b1, b1, b1, b1, b1, b2, b2, b2, b2, b2, b2, b3, b3, b3, b3, b3, b3, b3, b3]
        statuses     = [StudentStatus.active] * 16 + [StudentStatus.new] * 3 + [StudentStatus.stopped]
        sources      = ["instagram", "telegram", "referral", "advertisement", "website"]

        for i, name in enumerate(NAMES):
            s = Student(
                branch_id=branch_cycle[i].id, full_name=name, phone=phones[i],
                parent_phone=f"+9989{str(i+50).zfill(8)}",
                status=statuses[i],
                referral_source=random.choice(sources),
            )
            db.add(s)
            students.append(s)
        await db.flush()

        # ── StudentGroups ──────────────────────────────────────
        assignments = [
            # (student index, group index)
            (0,1),(1,2),(2,3),(3,0),(4,1),(5,2),
            (6,3),(7,0),(8,4),(9,1),(10,5),(11,2),
            (12,1),(13,3),(14,0),(15,4),(16,5),(17,3),
            (18,4),(19,1),
        ]
        for si, gi in assignments:
            db.add(StudentGroup(student_id=students[si].id, group_id=groups[gi].id))
        await db.flush()

        # ── Payments ───────────────────────────────────────────
        pay_statuses = [PaymentStatus.paid, PaymentStatus.paid, PaymentStatus.debt,
                        PaymentStatus.pending, PaymentStatus.paid]
        pay_methods  = [PaymentMethod.payme, PaymentMethod.cash, PaymentMethod.card,
                        PaymentMethod.click, PaymentMethod.cash]

        for i, (si, gi) in enumerate(assignments):
            st  = pay_statuses[i % len(pay_statuses)]
            mth = pay_methods[i % len(pay_methods)]
            fee = groups[gi].monthly_fee
            p   = Payment(
                branch_id=branch_cycle[si].id,
                student_id=students[si].id, group_id=groups[gi].id,
                amount=fee, discount=Decimal("0"),
                method=mth, status=st,
                period_month=today.month, period_year=today.year,
                receipt_no=f"REC-{today.strftime('%Y%m%d')}-{str(i).zfill(5)}",
                created_by=admins[0].id,
            )
            if st == PaymentStatus.paid:
                from datetime import datetime, timezone
                p.paid_at = datetime.now(timezone.utc)
            db.add(p)
        await db.flush()

        # ── Lessons + Attendance ───────────────────────────────
        for gi, group in enumerate(groups[:3]):  # Only first 3 groups for demo
            assigned_students = [students[si] for si, ggi in assignments if ggi == gi]
            for d in range(6):  # 6 lessons
                lesson_date = today - timedelta(days=30 - d * 5)
                lesson = Lesson(
                    group_id=group.id, teacher_id=group.teacher_id,
                    lesson_date=lesson_date,
                    start_time=time(10, 0, 0), end_time=time(12, 0, 0),
                    topic=f"Dars {d+1}",
                )
                db.add(lesson)
                await db.flush()

                for stu in assigned_students:
                    roll = random.random()
                    att_status = AttStatus.present if roll > 0.2 else (
                        AttStatus.excused if roll > 0.1 else AttStatus.absent
                    )
                    db.add(Attendance(lesson_id=lesson.id, student_id=stu.id, status=att_status))
        await db.flush()

        # ── Leads ──────────────────────────────────────────────
        lead_data = [
            ("Sarvar Yusupov",    "+998912340001", "IELTS Prep",     LeadSource.instagram,    LeadStage.new,      b1.id),
            ("Mohira Karimova",   "+998932340002", "English B1",     LeadSource.telegram,     LeadStage.new,      b1.id),
            ("Bekzod Toshev",     "+998902340003", "Math Advanced",  LeadSource.referral,     LeadStage.called,   b2.id),
            ("Nilufar Rashidova", "+998942340004", "English Starter",LeadSource.advertisement,LeadStage.trial,    b1.id),
            ("Jamshid Ergashev",  "+998972340005", "IT Basics",      LeadSource.website,      LeadStage.new,      b3.id),
            ("Gulnora Azimova",   "+998912340006", "Russian A1",     LeadSource.instagram,    LeadStage.enrolled, b2.id),
            ("Otabek Xoliqov",    "+998932340007", "IELTS Prep",     LeadSource.telegram,     LeadStage.called,   b1.id),
            ("Dilorom Saidova",   "+998902340008", "English B1",     LeadSource.referral,     LeadStage.rejected, b2.id),
        ]
        for name, phone, course, source, stage, bid in lead_data:
            db.add(Lead(
                branch_id=bid, full_name=name, phone=phone,
                course_interest=course, source=source, stage=stage,
            ))
        await db.flush()

        await db.commit()
        log.info("✅ Seed complete",
                 branches=len(branches), teachers=len(teachers),
                 groups=len(groups), students=len(students))


if __name__ == "__main__":
    asyncio.run(seed())
