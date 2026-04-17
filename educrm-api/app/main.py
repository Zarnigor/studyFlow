from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.exc import IntegrityError
import structlog, time

from app.core.config import get_settings
from app.db.session import check_db_connection
from app.utils.logger import setup_logging
from app.routers.routers import (
    auth_router, branch_router, user_router, subject_router,
    teacher_router, group_router, student_router,
    payment_router, lead_router, dashboard_router,
)
from app.routers.lessons  import lesson_router
from app.routers.telegram import telegram_router

settings = get_settings()
setup_logging()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting StudyFlow API", env=settings.APP_ENV, port=settings.APP_PORT)
    ok = await check_db_connection()
    if not ok:
        log.error("Cannot connect to database — check DATABASE_URL")
    else:
        log.info("Database connected")
    if settings.SENTRY_DSN:
        import sentry_sdk
        sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.2)
        log.info("Sentry initialized")
    if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_WEBHOOK_URL:
        try:
            from app.bot.bot import set_webhook
            await set_webhook()
            log.info("Telegram bot webhook configured", url=settings.TELEGRAM_WEBHOOK_URL)
        except Exception as e:
            log.warning("Telegram bot setup failed", error=str(e))
    yield
    log.info("Shutting down")


app = FastAPI(
    title="StudyFlow API",
    description="O'quv markaz boshqaruv tizimi",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = round((time.perf_counter() - start) * 1000, 1)
    log.info("req", method=request.method, path=request.url.path, status=response.status_code, ms=ms)
    response.headers["X-Process-Time"] = str(ms)
    return response

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    msg = str(exc.orig) if exc.orig else "Database error"
    if "unique" in msg.lower():
        return JSONResponse(status_code=409, content={"success":False,"error":{"code":"DUPLICATE_ENTRY","message":"Bu ma'lumot allaqachon mavjud"}})
    return JSONResponse(status_code=400, content={"success":False,"error":{"code":"DB_ERROR","message":msg}})

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"success":False,"error":{"code":"VALIDATION_ERROR","message":str(exc)}})

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    log.error("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(status_code=500, content={"success":False,"error":{"code":"INTERNAL_ERROR","message":"Ichki xatolik yuz berdi"}})


PREFIX = "/api/v1"
app.include_router(auth_router,      prefix=PREFIX)
app.include_router(branch_router,    prefix=PREFIX)
app.include_router(user_router,      prefix=PREFIX)
app.include_router(subject_router,   prefix=PREFIX)
app.include_router(teacher_router,   prefix=PREFIX)
app.include_router(group_router,     prefix=PREFIX)
app.include_router(student_router,   prefix=PREFIX)
app.include_router(payment_router,   prefix=PREFIX)
app.include_router(lesson_router,    prefix=PREFIX)   # ← dedicated router
app.include_router(lead_router,      prefix=PREFIX)
app.include_router(dashboard_router, prefix=PREFIX)
app.include_router(telegram_router,  prefix=PREFIX)


@app.get("/health", tags=["Health"])
async def health():
    db_ok = await check_db_connection()
    return {"status":"ok" if db_ok else "degraded","db":db_ok,"version":"1.0.0"}

@app.get("/", tags=["Health"])
async def root():
    return {"message":"StudyFlow API ishlamoqda","docs":"/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=not settings.is_production,
        workers=1 if not settings.is_production else 4,
    )
