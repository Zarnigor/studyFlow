from sqlalchemy import (
    Column, Integer, String, Boolean, Text, Date, Time,
    Numeric, BigInteger, ForeignKey, DateTime, Enum as SAEnum,
    UniqueConstraint, Index, func, Computed,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum


# ── Enums ─────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin       = "admin"
    manager     = "manager"
    teacher     = "teacher"
    cashier     = "cashier"


class StudentStatus(str, enum.Enum):
    new        = "new"
    active     = "active"
    stopped    = "stopped"
    graduated  = "graduated"


class SalaryType(str, enum.Enum):
    percent = "percent"
    fixed   = "fixed"


class PaymentStatus(str, enum.Enum):
    paid     = "paid"
    debt     = "debt"
    pending  = "pending"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    cash     = "cash"
    card     = "card"
    payme    = "payme"
    click    = "click"
    uzum     = "uzum"
    transfer = "transfer"


class AttStatus(str, enum.Enum):
    present = "present"
    absent  = "absent"
    excused = "excused"
    late    = "late"


class LeadStage(str, enum.Enum):
    new      = "new"
    called   = "called"
    trial    = "trial"
    enrolled = "enrolled"
    rejected = "rejected"


class LeadSource(str, enum.Enum):
    instagram    = "instagram"
    telegram     = "telegram"
    referral     = "referral"
    advertisement= "advertisement"
    website      = "website"
    walk_in      = "walk_in"
    other        = "other"


# ── Models ────────────────────────────────────────────────────
class Branch(Base):
    __tablename__ = "branches"
    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False)
    address    = Column(String(255))
    phone      = Column(String(20))
    city       = Column(String(100), default="Toshkent")
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users    = relationship("User",    back_populates="branch",   lazy="noload")
    groups   = relationship("Group",   back_populates="branch",   lazy="noload")
    students = relationship("Student", back_populates="branch",   lazy="noload")
    payments = relationship("Payment", back_populates="branch",   lazy="noload")
    leads    = relationship("Lead",    back_populates="branch",   lazy="noload")
    teachers = relationship("Teacher", back_populates="branch",   lazy="noload")


class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True)
    branch_id     = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True)
    full_name     = Column(String(150), nullable=False)
    phone         = Column(String(20), unique=True, nullable=False)
    email         = Column(String(150), unique=True, nullable=True)
    password_hash = Column(Text, nullable=False)
    role          = Column(SAEnum(UserRole), nullable=False, default=UserRole.manager)
    avatar_url    = Column(Text)
    is_active     = Column(Boolean, default=True)
    last_login    = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch  = relationship("Branch",  back_populates="users",    lazy="noload")
    teacher = relationship("Teacher", back_populates="user", uselist=False, lazy="noload")

    __table_args__ = (Index("idx_users_phone", "phone"),)


class Subject(Base):
    __tablename__ = "subjects"
    id         = Column(Integer, primary_key=True)
    name       = Column(String(100), nullable=False)
    color      = Column(String(7))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    teachers = relationship("Teacher", back_populates="subject", lazy="noload")
    groups   = relationship("Group",   back_populates="subject", lazy="noload")


class Teacher(Base):
    __tablename__ = "teachers"
    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    branch_id     = Column(Integer, ForeignKey("branches.id"), nullable=False)
    full_name     = Column(String(150), nullable=False)
    phone         = Column(String(20), nullable=False)
    subject_id    = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    salary_type   = Column(SAEnum(SalaryType), default=SalaryType.percent)
    salary_value  = Column(Numeric(12, 2), default=30)
    rating        = Column(Numeric(3, 1), default=5.0)
    bio           = Column(Text)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch  = relationship("Branch",  back_populates="teachers", lazy="noload")
    subject = relationship("Subject", back_populates="teachers", lazy="noload")
    groups  = relationship("Group",   back_populates="teacher",  lazy="noload")
    user    = relationship("User",    back_populates="teacher",  lazy="noload")

    __table_args__ = (Index("idx_teachers_branch", "branch_id"),)


class Room(Base):
    __tablename__ = "rooms"
    id        = Column(Integer, primary_key=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    name      = Column(String(50), nullable=False)
    capacity  = Column(Integer, default=20)
    is_active = Column(Boolean, default=True)


class Group(Base):
    __tablename__ = "groups"
    id          = Column(Integer, primary_key=True)
    branch_id   = Column(Integer, ForeignKey("branches.id"), nullable=False)
    teacher_id  = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    subject_id  = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    room_id     = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    name        = Column(String(100), nullable=False)
    level       = Column(String(50))
    capacity    = Column(Integer, default=15)
    monthly_fee = Column(Numeric(12, 2), default=500000)
    schedule    = Column(JSONB)
    start_date  = Column(Date)
    end_date    = Column(Date)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch         = relationship("Branch",       back_populates="groups",         lazy="noload")
    teacher        = relationship("Teacher",      back_populates="groups",         lazy="noload")
    subject        = relationship("Subject",      back_populates="groups",         lazy="noload")
    room           = relationship("Room",                                           lazy="noload")
    student_groups = relationship("StudentGroup", back_populates="group",
                                  cascade="all, delete",                           lazy="noload")
    lessons        = relationship("Lesson",       back_populates="group",          lazy="noload")

    __table_args__ = (Index("idx_groups_branch", "branch_id"),)


class Student(Base):
    __tablename__ = "students"
    id               = Column(Integer, primary_key=True)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=False)
    full_name        = Column(String(150), nullable=False)
    phone            = Column(String(20), nullable=False)
    parent_phone     = Column(String(20))
    birth_date       = Column(Date)
    address          = Column(Text)
    photo_url        = Column(Text)
    status           = Column(SAEnum(StudentStatus), default=StudentStatus.new)
    notes            = Column(Text)
    referral_source  = Column(String(100))
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch         = relationship("Branch",       back_populates="students",       lazy="noload")
    student_groups = relationship("StudentGroup", back_populates="student",
                                  cascade="all, delete",                           lazy="noload")
    payments       = relationship("Payment",      back_populates="student",        lazy="noload")
    attendances    = relationship("Attendance",   back_populates="student",        lazy="noload")

    __table_args__ = (
        Index("idx_students_branch",  "branch_id"),
        Index("idx_students_status",  "status"),
        Index("idx_students_phone",   "phone"),
    )


class StudentGroup(Base):
    __tablename__ = "student_groups"
    id         = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    group_id   = Column(Integer, ForeignKey("groups.id",   ondelete="CASCADE"), nullable=False)
    joined_at  = Column(Date, default=func.current_date())
    left_at    = Column(Date)
    is_active  = Column(Boolean, default=True)

    student = relationship("Student", back_populates="student_groups", lazy="noload")
    group   = relationship("Group",   back_populates="student_groups", lazy="noload")

    __table_args__ = (
        UniqueConstraint("student_id", "group_id"),
        Index("idx_sg_student", "student_id"),
        Index("idx_sg_group",   "group_id"),
    )


class Payment(Base):
    __tablename__ = "payments"
    id            = Column(Integer, primary_key=True)
    branch_id     = Column(Integer, ForeignKey("branches.id"), nullable=False)
    student_id    = Column(Integer, ForeignKey("students.id"), nullable=False)
    group_id      = Column(Integer, ForeignKey("groups.id"),   nullable=True)
    created_by    = Column(Integer, ForeignKey("users.id"),    nullable=True)
    amount        = Column(Numeric(12, 2), nullable=False)
    discount      = Column(Numeric(12, 2), default=0)
    method        = Column(SAEnum(PaymentMethod), default=PaymentMethod.cash)
    status        = Column(SAEnum(PaymentStatus), default=PaymentStatus.pending)
    period_month  = Column(Integer, nullable=False)
    period_year   = Column(Integer, nullable=False)
    payment_date  = Column(Date, nullable=True)
    paid_at       = Column(DateTime(timezone=True))
    notes         = Column(Text)
    receipt_no    = Column(String(50), unique=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch  = relationship("Branch",  back_populates="payments", lazy="noload")
    student = relationship("Student", back_populates="payments", lazy="noload")
    group   = relationship("Group",                              lazy="noload")

    __table_args__ = (
        Index("idx_payments_student", "student_id"),
        Index("idx_payments_period",  "period_year", "period_month"),
        Index("idx_payments_status",  "status"),
        Index("idx_payments_branch",  "branch_id"),
    )


class Lesson(Base):
    __tablename__ = "lessons"
    id            = Column(Integer, primary_key=True)
    group_id      = Column(Integer, ForeignKey("groups.id"),   nullable=False)
    teacher_id    = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    room_id       = Column(Integer, ForeignKey("rooms.id"),    nullable=True)
    lesson_date   = Column(Date, nullable=False)
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)
    topic         = Column(Text)
    is_cancelled  = Column(Boolean, default=False)
    cancel_reason = Column(Text)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    group       = relationship("Group",      back_populates="lessons",      lazy="noload")
    teacher     = relationship("Teacher",                                   lazy="noload")
    attendances = relationship("Attendance", back_populates="lesson",
                               cascade="all, delete",                       lazy="noload")

    __table_args__ = (Index("idx_lessons_group_date", "group_id", "lesson_date"),)


class Attendance(Base):
    __tablename__ = "attendance"
    id         = Column(Integer, primary_key=True)
    lesson_id  = Column(Integer, ForeignKey("lessons.id",  ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status     = Column(SAEnum(AttStatus), default=AttStatus.present)
    note       = Column(Text)
    marked_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    marked_at  = Column(DateTime(timezone=True), server_default=func.now())

    lesson  = relationship("Lesson",  back_populates="attendances", lazy="noload")
    student = relationship("Student",                               lazy="noload")

    __table_args__ = (
        UniqueConstraint("lesson_id", "student_id"),
        Index("idx_att_lesson",  "lesson_id"),
        Index("idx_att_student", "student_id"),
    )


class Lead(Base):
    __tablename__ = "leads"
    id                   = Column(Integer, primary_key=True)
    branch_id            = Column(Integer, ForeignKey("branches.id"), nullable=False)
    assigned_to          = Column(Integer, ForeignKey("users.id"), nullable=True)
    full_name            = Column(String(150), nullable=False)
    phone                = Column(String(20),  nullable=False)
    course_interest      = Column(String(100))
    source               = Column(SAEnum(LeadSource), default=LeadSource.other)
    stage                = Column(SAEnum(LeadStage),  default=LeadStage.new)
    notes                = Column(Text)
    trial_date           = Column(Date)
    converted_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())
    updated_at           = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    branch  = relationship("Branch",      back_populates="leads",   lazy="noload")
    history = relationship("LeadHistory", back_populates="lead",
                           cascade="all, delete",                    lazy="noload")

    __table_args__ = (
        Index("idx_leads_branch_stage", "branch_id", "stage"),
        Index("idx_leads_created",      "created_at"),
    )


class LeadHistory(Base):
    __tablename__ = "lead_history"
    id         = Column(Integer, primary_key=True)
    lead_id    = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    from_stage = Column(SAEnum(LeadStage))
    to_stage   = Column(SAEnum(LeadStage), nullable=False)
    note       = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="history", lazy="noload")


class SalaryPayment(Base):
    __tablename__ = "salary_payments"
    id           = Column(Integer, primary_key=True)
    teacher_id   = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    branch_id    = Column(Integer, ForeignKey("branches.id"), nullable=False)
    paid_by      = Column(Integer, ForeignKey("users.id"),    nullable=True)
    amount       = Column(Numeric(12, 2), nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year  = Column(Integer, nullable=False)
    method       = Column(SAEnum(PaymentMethod), default=PaymentMethod.cash)
    notes        = Column(Text)
    paid_at      = Column(DateTime(timezone=True), server_default=func.now())
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    teacher = relationship("Teacher", lazy="noload")


class TelegramSubscription(Base):
    __tablename__ = "telegram_subscriptions"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id",    ondelete="CASCADE"), nullable=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    chat_id    = Column(BigInteger, unique=True, nullable=False)
    username   = Column(String(100))
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())