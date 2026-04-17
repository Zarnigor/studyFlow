from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.session import get_db
from app.db.models import User, UserRole, PaymentStatus, LeadStage, StudentStatus, StudentGroup
from app.core.security import (
    get_current_user, require_admin, require_staff,
    require_super_admin, get_branch_filter,
    verify_password, create_access_token, create_refresh_token, decode_token,
    enforce_branch, safe_branch_id,
)
from app.schemas.schemas import *
from app.crud import crud
from pydantic import BaseModel as PydanticModel
import math


class AddStudentBody(PydanticModel):
    student_id: int

class AssignTeacherBody(PydanticModel):
    teacher_id: int

router = APIRouter()


# ════════════════════════════════════════════════════════════════
#  AUTH
# ════════════════════════════════════════════════════════════════
auth_router = APIRouter(prefix="/auth", tags=["Auth"])

@auth_router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_phone(db, body.phone)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Telefon yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akkaunt faol emas")
    await crud.record_login(db, user.id)
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.branch_id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )

@auth_router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid refresh token")
    from sqlalchemy import select
    user = (await db.execute(select(User).where(User.id == int(payload["sub"])))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.branch_id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )

@auth_router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ════════════════════════════════════════════════════════════════
#  BRANCHES
# ════════════════════════════════════════════════════════════════
branch_router = APIRouter(prefix="/branches", tags=["Branches"])

@branch_router.get("", response_model=list[BranchOut])
async def list_branches(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Super admin barcha filiallarni ko'radi, boshqalar faqat o'zinikini
    if current_user.role == UserRole.super_admin:
        return await crud.get_branches(db)
    if current_user.branch_id:
        branch = await crud.get_branch(db, current_user.branch_id)
        return [branch] if branch else []
    return []

@branch_router.post("", response_model=BranchOut, status_code=201)
async def create_branch(body: BranchIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_super_admin)):
    return await crud.create_branch(db, body.model_dump())

@branch_router.get("/{branch_id}", response_model=BranchOut)
async def get_branch(branch_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    # Admin faqat o'z filialini ko'ra oladi
    enforce_branch(current_user, branch_id)
    obj = await crud.get_branch(db, branch_id)
    if not obj: raise HTTPException(404, "Filial topilmadi")
    return obj

@branch_router.put("/{branch_id}", response_model=BranchOut)
async def update_branch(branch_id: int, body: BranchIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_super_admin)):
    obj = await crud.update_branch(db, branch_id, body.model_dump(exclude_none=True))
    if not obj: raise HTTPException(404, "Filial topilmadi")
    return obj


# ════════════════════════════════════════════════════════════════
#  USERS
# ════════════════════════════════════════════════════════════════
user_router = APIRouter(prefix="/users", tags=["Users"])

@user_router.get("", response_model=list[UserOut])
async def list_users(branch_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    bid = get_branch_filter(current_user, branch_id)
    return await crud.get_users(db, bid)

@user_router.post("", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    # Admin o'z filialida user yarata oladi, super_admin istalgan filialda
    body_dict = body.model_dump()
    body_dict["branch_id"] = safe_branch_id(current_user, body.branch_id)
    existing = await crud.get_user_by_phone(db, body.phone)
    if existing: raise HTTPException(409, "Bu telefon raqam band")
    return await crud.create_user(db, body_dict)

@user_router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: int, body: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    from sqlalchemy import select
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target: raise HTTPException(404, "Foydalanuvchi topilmadi")
    if target.branch_id: enforce_branch(current_user, target.branch_id)
    obj = await crud.update_user(db, user_id, body.model_dump(exclude_none=True))
    return obj


# ════════════════════════════════════════════════════════════════
#  SUBJECTS
# ════════════════════════════════════════════════════════════════
subject_router = APIRouter(prefix="/subjects", tags=["Subjects"])

@subject_router.get("", response_model=list[SubjectOut])
async def list_subjects(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await crud.get_subjects(db)

@subject_router.post("", response_model=SubjectOut, status_code=201)
async def create_subject(body: SubjectIn, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    return await crud.create_subject(db, body.model_dump())


# ════════════════════════════════════════════════════════════════
#  TEACHERS
# ════════════════════════════════════════════════════════════════
teacher_router = APIRouter(prefix="/teachers", tags=["Teachers"])

def teacher_to_dict(t) -> dict:
    groups = t.groups or []
    return {
        "id":           t.id,
        "branch_id":    t.branch_id,
        "full_name":    t.full_name,
        "phone":        t.phone,
        "subject_id":   t.subject_id,
        "salary_type":  t.salary_type.value if hasattr(t.salary_type, "value") else str(t.salary_type or "percent"),
        "salary_value": float(t.salary_value or 0),
        "rating":       float(t.rating or 5),
        "bio":          t.bio,
        "is_active":    t.is_active,
        "groups":       [{"id": g.id, "name": g.name} for g in groups],
        "group_count":  len(groups),
        "students":     sum(
            len([sg for sg in (g.student_groups or []) if sg.is_active])
            for g in groups
        ),
    }

@teacher_router.get("")
async def list_teachers(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bid = get_branch_filter(current_user, branch_id)
    teachers = await crud.get_teachers(db, bid)
    return [teacher_to_dict(t) for t in teachers]

@teacher_router.post("", status_code=201)
async def create_teacher(
    body: TeacherIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    data = body.model_dump()
    data["branch_id"] = safe_branch_id(current_user, data.get("branch_id"))
    t = await crud.create_teacher(db, data)
    t = await crud.get_teacher(db, t.id)
    return teacher_to_dict(t)

@teacher_router.get("/{teacher_id}")
async def get_teacher(
    teacher_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = await crud.get_teacher(db, teacher_id)
    if not t:
        raise HTTPException(404, "O'qituvchi topilmadi")
    enforce_branch(current_user, t.branch_id)
    return teacher_to_dict(t)

@teacher_router.put("/{teacher_id}")
async def update_teacher(
    teacher_id: int,
    body: TeacherUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    t = await crud.get_teacher(db, teacher_id)
    if not t:
        raise HTTPException(404, "O'qituvchi topilmadi")
    enforce_branch(current_user, t.branch_id)
    t = await crud.update_teacher(db, teacher_id, body.model_dump(exclude_none=True))
    t = await crud.get_teacher(db, teacher_id)
    return teacher_to_dict(t)


# ════════════════════════════════════════════════════════════════
#  GROUPS
# ════════════════════════════════════════════════════════════════
group_router = APIRouter(prefix="/groups", tags=["Groups"])

def group_to_dict(g) -> dict:
    teacher = g.teacher
    sgs     = g.student_groups or []
    return {
        "id":            g.id,
        "branch_id":     g.branch_id,
        "teacher_id":    g.teacher_id,
        "subject_id":    g.subject_id,
        "name":          g.name,
        "level":         g.level,
        "capacity":      g.capacity,
        "monthly_fee":   float(g.monthly_fee or 0),
        "schedule":      g.schedule,
        "start_date":    g.start_date.isoformat() if g.start_date else None,
        "end_date":      g.end_date.isoformat()   if g.end_date   else None,
        "is_active":     g.is_active,
        "teacher": {
            "id":        teacher.id,
            "full_name": teacher.full_name,
            "phone":     teacher.phone,
        } if teacher else None,
        "student_groups": [
            {
                "id":         sg.id,
                "student_id": sg.student_id,
                "is_active":  sg.is_active,
                "joined_at":  sg.joined_at.isoformat() if sg.joined_at else None,
                "student": {
                    "id":        sg.student.id,
                    "full_name": sg.student.full_name,
                    "phone":     sg.student.phone,
                } if sg.student else None,
            }
            for sg in sgs
        ],
        "student_count": len([sg for sg in sgs if sg.is_active]),
    }

@group_router.get("")
async def list_groups(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bid    = get_branch_filter(current_user, branch_id)
    groups = await crud.get_groups(db, bid)
    return [group_to_dict(g) for g in groups]

@group_router.post("", status_code=201)
async def create_group(
    body: GroupIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    data = body.model_dump()
    data["branch_id"] = safe_branch_id(current_user, data.get("branch_id"))
    g = await crud.create_group(db, data)
    g = await crud.get_group(db, g.id)
    return group_to_dict(g)

@group_router.get("/{group_id}")
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    g = await crud.get_group(db, group_id)
    if not g:
        raise HTTPException(404, "Guruh topilmadi")
    enforce_branch(current_user, g.branch_id)
    return group_to_dict(g)

@group_router.put("/{group_id}")
async def update_group(
    group_id: int,
    body: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    g = await crud.get_group(db, group_id)
    if not g:
        raise HTTPException(404, "Guruh topilmadi")
    enforce_branch(current_user, g.branch_id)
    await crud.update_group(db, group_id, body.model_dump(exclude_none=True))
    g = await crud.get_group(db, group_id)
    return group_to_dict(g)

@group_router.put("/{group_id}/teacher")
async def assign_teacher_to_group(
    group_id: int,
    body: AssignTeacherBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    g = await crud.get_group(db, group_id)
    if not g:
        raise HTTPException(404, "Guruh topilmadi")
    enforce_branch(current_user, g.branch_id)

    t = await crud.get_teacher(db, body.teacher_id)
    if not t:
        raise HTTPException(404, "O'qituvchi topilmadi")
    if t.branch_id != g.branch_id:
        raise HTTPException(400, "O'qituvchi va guruh bir filialda bo'lishi kerak")

    g.teacher_id = body.teacher_id
    await db.flush()
    g = await crud.get_group(db, group_id)
    return {"success": True, "data": group_to_dict(g)}

@group_router.post("/{group_id}/students", status_code=201)
async def add_student(
    group_id: int,
    body: AddStudentBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    g = await crud.get_group(db, group_id)
    if not g:
        raise HTTPException(404, "Guruh topilmadi")
    enforce_branch(current_user, g.branch_id)

    cnt = await crud.count_group_students(db, group_id)
    if cnt >= g.capacity:
        raise HTTPException(400, f"Guruh to'lgan ({cnt}/{g.capacity})")

    already = (await db.execute(
        select(StudentGroup).where(
            StudentGroup.group_id   == group_id,
            StudentGroup.student_id == body.student_id,
            StudentGroup.is_active  == True,
        )
    )).scalar_one_or_none()
    if already:
        raise HTTPException(400, "Bu talaba allaqachon guruhda")

    sg = await crud.add_student_to_group(db, body.student_id, group_id)
    return {"success": True, "data": {"id": sg.id, "student_id": sg.student_id, "group_id": sg.group_id}}

@group_router.delete("/{group_id}/students/{student_id}", response_model=OKResponse)
async def remove_student(
    group_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    g = await crud.get_group(db, group_id)
    if not g:
        raise HTTPException(404, "Guruh topilmadi")
    enforce_branch(current_user, g.branch_id)
    await crud.remove_student_from_group(db, student_id, group_id)
    return OKResponse(message="Talaba guruhdan chiqarildi")


# ════════════════════════════════════════════════════════════════
#  STUDENTS
# ════════════════════════════════════════════════════════════════
student_router = APIRouter(prefix="/students", tags=["Students"])

def student_to_dict(s) -> dict:
    return {
        "id":              s.id,
        "branch_id":       s.branch_id,
        "full_name":       s.full_name,
        "phone":           s.phone,
        "parent_phone":    s.parent_phone,
        "birth_date":      s.birth_date.isoformat() if s.birth_date else None,
        "status":          s.status.value if hasattr(s.status, "value") else str(s.status),
        "notes":           s.notes,
        "referral_source": s.referral_source,
        "created_at":      s.created_at.isoformat() if s.created_at else None,
    }

@student_router.get("")
async def list_students(
    branch_id: Optional[int] = None,
    status:    Optional[str] = None,
    q:         Optional[str] = None,
    page:      int = Query(default=1, ge=1),
    limit:     int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bid = get_branch_filter(current_user, branch_id)
    st  = StudentStatus(status) if status else None
    items, total = await crud.get_students(db, bid, st, q, page, limit)
    return {
        "success": True,
        "data":    [student_to_dict(s) for s in items],
        "meta":    {
            "page":  page,
            "limit": limit,
            "total": total,
            "pages": math.ceil(total / limit) if total else 1,
        },
    }

@student_router.post("", status_code=201)
async def create_student(
    body: StudentIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    data = body.model_dump()
    data["branch_id"] = safe_branch_id(current_user, data.get("branch_id"))
    s = await crud.create_student(db, data)
    return {"success": True, "data": student_to_dict(s)}

@student_router.get("/{student_id}")
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = await crud.get_student(db, student_id)
    if not s:
        raise HTTPException(404, "Talaba topilmadi")
    enforce_branch(current_user, s.branch_id)
    return {"success": True, "data": student_to_dict(s)}

@student_router.put("/{student_id}")
async def update_student(
    student_id: int,
    body: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    s = await crud.get_student(db, student_id)
    if not s:
        raise HTTPException(404, "Talaba topilmadi")
    enforce_branch(current_user, s.branch_id)
    s = await crud.update_student(db, student_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": student_to_dict(s)}

@student_router.delete("/{student_id}", response_model=OKResponse)
async def deactivate_student(student_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    obj = await crud.get_student(db, student_id)
    if not obj: raise HTTPException(404, "Talaba topilmadi")
    enforce_branch(current_user, obj.branch_id)
    await crud.update_student(db, student_id, {"status": StudentStatus.stopped})
    return OKResponse(message="Talaba to'xtatildi")

@student_router.get("/{student_id}/groups")
async def student_groups(student_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    obj = await crud.get_student(db, student_id)
    if not obj: raise HTTPException(404, "Talaba topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return {"success": True, "data": [StudentGroupOut.model_validate(sg) for sg in obj.student_groups]}

@student_router.post("/{student_id}/groups", response_model=StudentGroupOut, status_code=201)
async def enroll_student(student_id: int, body: StudentGroupAdd, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    obj = await crud.get_student(db, student_id)
    if not obj: raise HTTPException(404, "Talaba topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return await crud.add_student_to_group(db, student_id, body.group_id)



@user_router.put("/{user_id}/change-password", response_model=OKResponse)
async def change_password(
    user_id: int, body: ChangePasswordIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User o'z parolini o'zgartiradi. Admin boshqa userning parolini ham o'zgartira oladi."""
    from sqlalchemy import select as sa_select
    from app.core.security import hash_password as hp
    # Faqat o'zi yoki admin
    if current_user.id != user_id and current_user.role not in [UserRole.super_admin, UserRole.admin]:
        raise HTTPException(403, "Faqat o'z parolingizni o'zgartira olasiz")
    target = (await db.execute(sa_select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    target.password_hash = hp(body.password)
    await db.flush()
    return OKResponse(message="Parol muvaffaqiyatli o'zgartirildi")

# ════════════════════════════════════════════════════════════════
#  PAYMENTS
# ════════════════════════════════════════════════════════════════
payment_router = APIRouter(prefix="/payments", tags=["Payments"])

@payment_router.get("")
async def list_payments(
    branch_id: Optional[int] = None, student_id: Optional[int] = None,
    status: Optional[str] = None, period_month: Optional[int] = None,
    period_year: Optional[int] = None,
    page: int = Query(default=1, ge=1), limit: int = Query(default=20, ge=1, le=500),
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    bid = get_branch_filter(current_user, branch_id)
    st  = PaymentStatus(status) if status else None
    items, total = await crud.get_payments(db, bid, student_id, st, period_month, period_year, page, limit)
    return {
        "success": True,
        "data":    [PaymentOut.model_validate(p) for p in items],
        "meta":    {"page": page, "limit": limit, "total": total, "pages": math.ceil(total/limit)},
    }

@payment_router.post("", response_model=PaymentOut, status_code=201)
async def create_payment(body: PaymentIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    data = body.model_dump()
    data["branch_id"] = safe_branch_id(current_user, data.get("branch_id"))
    return await crud.create_payment(db, data, current_user.id)

@payment_router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    obj = await crud.get_payment(db, payment_id)
    if not obj: raise HTTPException(404, "To'lov topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return obj

@payment_router.put("/{payment_id}", response_model=PaymentOut)
async def update_payment(payment_id: int, body: PaymentUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    obj = await crud.get_payment(db, payment_id)
    if not obj: raise HTTPException(404, "To'lov topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return await crud.update_payment(db, payment_id, body.model_dump(exclude_none=True))

@payment_router.post("/generate-monthly", response_model=OKResponse)
async def generate_monthly(body: PaymentBulkGenerate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    # Faqat o'z filialida generate qilish mumkin
    branch_id = safe_branch_id(current_user, body.branch_id)
    count = await crud.bulk_generate_payments(db, branch_id, body.period_month, body.period_year, current_user.id)
    return OKResponse(message=f"{count} ta to'lov yaratildi")

@payment_router.get("/report/debtors")
async def debtors_report(branch_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    bid = get_branch_filter(current_user, branch_id)
    items, total = await crud.get_payments(db, bid, None, PaymentStatus.debt, None, None, 1, 200)
    return {"success": True, "data": [PaymentOut.model_validate(p) for p in items], "total": total}


# ════════════════════════════════════════════════════════════════
#  LEADS
# ════════════════════════════════════════════════════════════════
lead_router = APIRouter(prefix="/leads", tags=["Leads"])

@lead_router.get("")
async def list_leads(
    branch_id: Optional[int] = None, stage: Optional[str] = None, q: Optional[str] = None,
    page: int = Query(default=1, ge=1), limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user),
):
    bid = get_branch_filter(current_user, branch_id)
    st  = LeadStage(stage) if stage else None
    items, total = await crud.get_leads(db, bid, st, q, page, limit)
    return {
        "success": True,
        "data":    [LeadOut.model_validate(l) for l in items],
        "meta":    {"page": page, "limit": limit, "total": total, "pages": math.ceil(total/limit)},
    }

@lead_router.post("", response_model=LeadOut, status_code=201)
async def create_lead(body: LeadIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    data = body.model_dump()
    data["branch_id"] = safe_branch_id(current_user, data.get("branch_id"))
    return await crud.create_lead(db, data)

@lead_router.get("/funnel")
async def lead_funnel(branch_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    bid = get_branch_filter(current_user, branch_id)
    return {"success": True, "data": await crud.get_lead_funnel(db, bid)}

@lead_router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    obj = await crud.get_lead(db, lead_id)
    if not obj: raise HTTPException(404, "Ariza topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return obj

@lead_router.put("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: int, body: LeadUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    obj = await crud.get_lead(db, lead_id)
    if not obj: raise HTTPException(404, "Ariza topilmadi")
    enforce_branch(current_user, obj.branch_id)
    return await crud.update_lead(db, lead_id, body.model_dump(exclude_none=True), current_user.id)

@lead_router.delete("/{lead_id}", response_model=OKResponse)
async def delete_lead(lead_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    obj = await crud.get_lead(db, lead_id)
    if not obj: raise HTTPException(404, "Ariza topilmadi")
    enforce_branch(current_user, obj.branch_id)
    from sqlalchemy import delete as sa_delete
    from app.db.models import Lead
    await db.execute(sa_delete(Lead).where(Lead.id == lead_id))
    return OKResponse(message="Ariza o'chirildi")

@lead_router.post("/{lead_id}/convert", response_model=StudentOut)
async def convert_lead(lead_id: int, body: LeadConvertIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)):
    lead = await crud.get_lead(db, lead_id)
    if not lead: raise HTTPException(404, "Ariza topilmadi")
    enforce_branch(current_user, lead.branch_id)
    if lead.stage == LeadStage.enrolled:
        raise HTTPException(400, "Bu ariza allaqachon talabaga aylangan")
    student = await crud.convert_lead(db, lead, body.group_id, current_user.id)
    return StudentOut.model_validate(student)

@lead_router.get("/{lead_id}/history", response_model=list[LeadHistoryOut])
async def lead_history(lead_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = await crud.get_lead(db, lead_id)
    if not lead: raise HTTPException(404, "Ariza topilmadi")
    enforce_branch(current_user, lead.branch_id)
    return lead.history


# ════════════════════════════════════════════════════════════════
#  DASHBOARD
# ════════════════════════════════════════════════════════════════
dashboard_router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@dashboard_router.get("")
async def get_dashboard(branch_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Admin faqat o'z filiali dashboard ini ko'ra oladi
    bid  = get_branch_filter(current_user, branch_id)
    data = await crud.get_dashboard_data(db, bid)
    return {"success": True, "data": data}
