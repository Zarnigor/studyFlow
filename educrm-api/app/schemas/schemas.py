from __future__ import annotations
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator
import re
from app.db.models import (
    UserRole, StudentStatus, SalaryType,
    PaymentStatus, PaymentMethod, AttStatus,
    LeadStage, LeadSource,
)


# ── Shared ────────────────────────────────────────────────────
class OKResponse(BaseModel):
    success: bool = True
    message: str  = "OK"

class PaginationMeta(BaseModel):
    page:  int
    limit: int
    total: int
    pages: int

class PaginatedResponse(BaseModel):
    success: bool         = True
    data:    list[Any]    = []
    meta:    PaginationMeta


def phone_validator(v: str) -> str:
    # Strip spaces, hyphens, parentheses and other separators
    cleaned = re.sub(r"[^\d+]", "", v)
    if not re.match(r"^\+998\d{9}$", cleaned):
        raise ValueError("Phone must be in format +998XXXXXXXXX")
    return cleaned


# ── Auth ──────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    phone:    str = Field(..., example="+998901234567")
    password: str = Field(..., min_length=6)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v): return phone_validator(v)

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str  = "bearer"
    user:          "UserOut"

class RefreshRequest(BaseModel):
    refresh_token: str


# ── Branch ────────────────────────────────────────────────────
class BranchIn(BaseModel):
    name:      str = Field(..., min_length=2, max_length=100)
    address:   Optional[str] = None
    phone:     Optional[str] = None
    city:      str = "Toshkent"
    is_active: bool = True

class BranchOut(BranchIn):
    id:         int
    created_at: datetime
    class Config: from_attributes = True


# ── User ──────────────────────────────────────────────────────
class UserCreate(BaseModel):
    branch_id: Optional[int] = None
    full_name: str = Field(..., min_length=2, max_length=150)
    phone:     str
    email:     Optional[str] = None
    password:  str = Field(..., min_length=6)
    role:      UserRole = UserRole.manager

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v): return phone_validator(v)

class UserUpdate(BaseModel):
    full_name:  Optional[str] = None
    email:      Optional[str] = None
    role:       Optional[UserRole] = None
    is_active:  Optional[bool] = None
    branch_id:  Optional[int] = None

class UserOut(BaseModel):
    id:        int
    full_name: str
    phone:     str
    email:     Optional[str]
    role:      UserRole
    branch_id: Optional[int]
    is_active: bool
    class Config: from_attributes = True


# ── Subject ───────────────────────────────────────────────────
class SubjectIn(BaseModel):
    name:  str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = None

class SubjectOut(SubjectIn):
    id:         int
    created_at: datetime
    class Config: from_attributes = True


# ── Teacher ───────────────────────────────────────────────────
class TeacherIn(BaseModel):
    branch_id:    int
    full_name:    str  = Field(..., min_length=2, max_length=150)
    phone:        str
    subject_id:   Optional[int] = None
    salary_type:  SalaryType    = SalaryType.percent
    salary_value: Decimal       = Field(default=30, ge=0)
    bio:          Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v): return phone_validator(v)

class TeacherUpdate(BaseModel):
    full_name:    Optional[str]       = None
    phone:        Optional[str]       = None
    subject_id:   Optional[int]       = None
    salary_type:  Optional[SalaryType]= None
    salary_value: Optional[Decimal]   = None
    bio:          Optional[str]       = None
    is_active:    Optional[bool]      = None
    user_id:      Optional[int]       = None

class GroupBrief(BaseModel):
    id:   int
    name: str
    class Config: from_attributes = True

class TeacherOut(BaseModel):
    id:           int
    branch_id:    int
    full_name:    str
    phone:        str
    subject_id:   Optional[int]
    salary_type:  SalaryType
    salary_value: Decimal
    bio:          Optional[str]
    is_active:    bool
    created_at:   datetime
    groups:       list[GroupBrief] = []
    class Config: from_attributes = True


# ── Group ─────────────────────────────────────────────────────
class GroupIn(BaseModel):
    branch_id:   int
    teacher_id:  Optional[int] = None
    subject_id:  Optional[int] = None
    room_id:     Optional[int] = None
    name:        str = Field(..., min_length=1, max_length=100)
    level:       Optional[str] = None
    capacity:    int = Field(default=15, ge=1, le=100)
    monthly_fee: Decimal = Field(default=500000, ge=0)
    schedule:    Optional[dict] = None
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None

class GroupUpdate(BaseModel):
    teacher_id:  Optional[int]     = None
    subject_id:  Optional[int]     = None
    room_id:     Optional[int]     = None
    name:        Optional[str]     = None
    level:       Optional[str]     = None
    capacity:    Optional[int]     = None
    monthly_fee: Optional[Decimal] = None
    schedule:    Optional[dict]    = None
    is_active:   Optional[bool]    = None

class GroupOut(BaseModel):
    id:          int
    branch_id:   int
    teacher_id:  int
    subject_id:  Optional[int]
    name:        str
    level:       Optional[str]
    capacity:    int
    monthly_fee: Decimal
    schedule:    Optional[dict]
    start_date:  Optional[date]
    end_date:    Optional[date] = None
    is_active:   bool
    student_count:  Optional[int] = 0
    student_groups: list["StudentGroupOut"] = []
    class Config: from_attributes = True


# ── Student ───────────────────────────────────────────────────
class StudentIn(BaseModel):
    branch_id:       int
    full_name:       str  = Field(..., min_length=2, max_length=150)
    phone:           str
    parent_phone:    Optional[str] = None
    birth_date:      Optional[date] = None
    address:         Optional[str] = None
    status:          StudentStatus = StudentStatus.new
    notes:           Optional[str] = None
    referral_source: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v): return phone_validator(v)

class StudentUpdate(BaseModel):
    full_name:       Optional[str]           = None
    phone:           Optional[str]           = None
    parent_phone:    Optional[str]           = None
    birth_date:      Optional[date]          = None
    address:         Optional[str]           = None
    status:          Optional[StudentStatus] = None
    notes:           Optional[str]           = None
    referral_source: Optional[str]           = None

class StudentOut(BaseModel):
    id:              int
    branch_id:       int
    full_name:       str
    phone:           str
    parent_phone:    Optional[str]
    birth_date:      Optional[date]
    status:          StudentStatus
    notes:           Optional[str]
    referral_source: Optional[str]
    created_at:      datetime
    class Config: from_attributes = True

class StudentBasic(BaseModel):
    id:        int
    full_name: str
    phone:     str
    class Config: from_attributes = True

class StudentGroupAdd(BaseModel):
    student_id: int

class StudentGroupOut(BaseModel):
    id:         int
    student_id: int
    group_id:   int
    joined_at:  date
    is_active:  bool
    student:    Optional[StudentBasic] = None
    class Config: from_attributes = True

# Resolve forward reference in GroupOut
GroupOut.model_rebuild()


# ── Payment ───────────────────────────────────────────────────
class PaymentIn(BaseModel):
    branch_id:    int
    student_id:   int
    group_id:     Optional[int]   = None
    amount:       Decimal         = Field(..., ge=0)
    discount:     Decimal         = Field(default=0, ge=0)
    method:       PaymentMethod   = PaymentMethod.cash
    status:       PaymentStatus   = PaymentStatus.pending
    period_month: int             = Field(..., ge=1, le=12)
    period_year:  int             = Field(..., ge=2020, le=2100)
    payment_date: Optional[date]  = None
    notes:        Optional[str]   = None

class PaymentUpdate(BaseModel):
    status:  Optional[PaymentStatus] = None
    method:  Optional[PaymentMethod] = None
    notes:   Optional[str]           = None
    paid_at: Optional[datetime]      = None

class PaymentOut(BaseModel):
    id:           int
    branch_id:    int
    student_id:   int
    group_id:     Optional[int]
    amount:       Decimal
    discount:     Decimal
    method:       PaymentMethod
    status:       PaymentStatus
    period_month: int
    period_year:  int
    payment_date: Optional[date]  = None
    paid_at:      Optional[datetime]
    receipt_no:   Optional[str]
    notes:        Optional[str]
    created_at:   datetime
    student_name: Optional[str] = None
    class Config: from_attributes = True

class PaymentBulkGenerate(BaseModel):
    branch_id:    int
    period_month: int = Field(..., ge=1, le=12)
    period_year:  int = Field(..., ge=2020, le=2100)


# ── Attendance ────────────────────────────────────────────────
class LessonIn(BaseModel):
    group_id:    int
    teacher_id:  int
    room_id:     Optional[int] = None
    lesson_date: date
    start_time:  str  = Field(..., example="10:00")
    end_time:    str  = Field(..., example="12:00")
    topic:       Optional[str] = None

class LessonUpdateIn(BaseModel):
    topic:         Optional[str]  = None
    start_time:    Optional[str]  = None
    end_time:      Optional[str]  = None
    room_id:       Optional[int]  = None
    is_cancelled:  Optional[bool] = None
    cancel_reason: Optional[str]  = None

class LessonOut(BaseModel):
    id:           int
    group_id:     int
    teacher_id:   int
    lesson_date:  date
    start_time:   Any
    end_time:     Any
    topic:        Optional[str]
    is_cancelled: bool
    created_at:   datetime
    class Config: from_attributes = True

class AttendanceEntry(BaseModel):
    student_id: int
    status:     AttStatus = AttStatus.present
    note:       Optional[str] = None

class AttendanceBulkIn(BaseModel):
    entries: list[AttendanceEntry]

class AttendanceOut(BaseModel):
    id:         int
    lesson_id:  int
    student_id: int
    status:     AttStatus
    note:       Optional[str]
    marked_at:  datetime
    class Config: from_attributes = True


# ── Lead ──────────────────────────────────────────────────────
class LeadIn(BaseModel):
    branch_id:       int
    full_name:       str = Field(..., min_length=2, max_length=150)
    phone:           str
    course_interest: Optional[str]    = None
    source:          LeadSource       = LeadSource.other
    stage:           LeadStage        = LeadStage.new
    notes:           Optional[str]    = None
    trial_date:      Optional[date]   = None
    assigned_to:     Optional[int]    = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v): return phone_validator(v)

class LeadUpdate(BaseModel):
    full_name:       Optional[str]       = None
    phone:           Optional[str]       = None
    course_interest: Optional[str]       = None
    source:          Optional[LeadSource]= None
    stage:           Optional[LeadStage] = None
    notes:           Optional[str]       = None
    trial_date:      Optional[date]      = None
    assigned_to:     Optional[int]       = None

class LeadOut(BaseModel):
    id:                   int
    branch_id:            int
    full_name:            str
    phone:                str
    course_interest:      Optional[str]
    source:               LeadSource
    stage:                LeadStage
    notes:                Optional[str]
    trial_date:           Optional[date]
    assigned_to:          Optional[int]
    converted_student_id: Optional[int]
    created_at:           datetime
    class Config: from_attributes = True

class LeadConvertIn(BaseModel):
    group_id: Optional[int] = None

class ChangePasswordIn(BaseModel):
    password: str = Field(..., min_length=6)

class LeadHistoryOut(BaseModel):
    id:         int
    from_stage: Optional[LeadStage]
    to_stage:   LeadStage
    note:       Optional[str]
    created_at: datetime
    class Config: from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────
class KpiData(BaseModel):
    total_students:  int
    new_students:    int
    monthly_revenue: Decimal
    prev_revenue:    Decimal
    active_groups:   int
    debtors:         int

class RevenuePoint(BaseModel):
    month:   int
    year:    int
    revenue: Decimal
    target:  Decimal

class DashboardOut(BaseModel):
    kpi:             KpiData
    revenue_trend:   list[RevenuePoint]
    student_by_group: list[dict]
    recent_payments:  list[PaymentOut]
    alerts:           list[str]
