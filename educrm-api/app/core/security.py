from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.db.session import get_db
from app.db.models import User, UserRole

settings   = get_settings()
pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer     = HTTPBearer()


# ── Password ──────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────
def create_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def create_access_token(user_id: int, role: str, branch_id: Optional[int]) -> str:
    return create_token(
        {"sub": str(user_id), "role": role, "branch_id": branch_id},
        timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES),
    )

def create_refresh_token(user_id: int) -> str:
    return create_token(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS),
    )

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


# ── Current user dependency ───────────────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = int(payload.get("sub", 0))
    result  = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user    = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


# ── Role-based dependency factory ─────────────────────────────
def require_roles(*roles: UserRole):
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker

# Shortcuts
require_admin         = require_roles(UserRole.super_admin, UserRole.admin)
require_super_admin   = require_roles(UserRole.super_admin)
require_staff         = require_roles(UserRole.super_admin, UserRole.admin, UserRole.manager, UserRole.cashier)

# Dars va davomat uchun: admin/manager + o'qituvchi (lekin cashier emas)
require_lesson_access = require_roles(UserRole.super_admin, UserRole.admin, UserRole.manager, UserRole.teacher)

# Dars yaratish: admin, manager va o'qituvchi (o'z guruhida)
require_lesson_create = require_roles(UserRole.super_admin, UserRole.admin, UserRole.manager, UserRole.teacher)


# ── Branch filter helper ───────────────────────────────────────
def get_branch_filter(current_user: User, branch_id: Optional[int] = None) -> Optional[int]:
    """Super admin can query any branch; others are locked to their own."""
    if current_user.role == UserRole.super_admin:
        return branch_id  # None means all branches
    return current_user.branch_id


def enforce_branch(current_user: "User", resource_branch_id: int) -> None:
    """
    Resurs shu foydalanuvchining filialigami tekshiradi.
    Super admin barcha filiallarga kira oladi.
    Boshqalar faqat o'z filialiga.
    """
    if current_user.role == UserRole.super_admin:
        return
    if current_user.branch_id != resource_branch_id:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=403,
            detail="Siz faqat o'z filialingiz ma'lumotlarini boshqara olasiz"
        )


def safe_branch_id(current_user: "User", requested_branch_id: int = None) -> int:
    """
    CREATE uchun: admin o'zganing filialini kirita olmaydi.
    Super admin istalgan branch_id bera oladi.
    """
    from fastapi import HTTPException
    if current_user.role == UserRole.super_admin:
        if not requested_branch_id:
            raise HTTPException(400, "Super admin uchun branch_id shart")
        return requested_branch_id
    if not current_user.branch_id:
        raise HTTPException(400, "Foydalanuvchiga filial biriktirilmagan")
    return current_user.branch_id
