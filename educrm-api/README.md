# StudyFlow — FastAPI Backend

Production-ready REST API — FastAPI + PostgreSQL + Docker

## Tezkor ishga tushirish

```bash
# 1. Klonlash / arxivdan chiqarish
cd educrm-api

# 2. .env fayl
cp .env.example .env
# .env ni tahrirlang: DB_PASSWORD, JWT_SECRET, ALLOWED_ORIGINS

# 3. Docker bilan (tavsiya)
docker compose up -d

# 4. API ishlayapti:
#    http://localhost:8000/docs    ← Swagger UI
#    http://localhost:8000/health  ← Health check
```

---

## Oddiy ishga tushirish (Docker siz)

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# .env faylni to'ldiring
cp .env.example .env

# Ma'lumotlar bazasini yaratish
createdb educrm
psql educrm < database/schema.sql

# Migratsiyanlar
alembic upgrade head

# Ishga tushirish
python -m app.main
# yoki
uvicorn app.main:app --reload --port 8000
```

---

## Loyiha tuzilmasi

```
educrm-api/
├── app/
│   ├── main.py               ← FastAPI app, middleware, routers
│   ├── core/
│   │   ├── config.py         ← Settings (pydantic-settings)
│   │   └── security.py       ← JWT, bcrypt, role dependencies
│   ├── db/
│   │   ├── session.py        ← Async SQLAlchemy engine + get_db()
│   │   └── models.py         ← Barcha ORM modellari (15 ta jadval)
│   ├── schemas/
│   │   └── schemas.py        ← Pydantic schemas (In/Out/Response)
│   ├── crud/
│   │   └── crud.py           ← Barcha DB operatsiyalari
│   ├── routers/
│   │   └── routers.py        ← Barcha API endpointlar
│   └── utils/
│       └── logger.py         ← Structlog setup
├── alembic/                  ← Database migrations
├── database/
│   └── schema.sql            ← PostgreSQL DDL
├── nginx/
│   └── nginx.conf            ← Reverse proxy config
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

---

## API Endpointlar (to'liq ro'yxat)

Base URL: `http://localhost:8000/api/v1`

### 🔐 Auth
| Method | Endpoint        | Tavsif                |
|--------|----------------|-----------------------|
| POST   | /auth/login     | Login → JWT token     |
| POST   | /auth/refresh   | Token yangilash       |
| GET    | /auth/me        | Joriy foydalanuvchi   |

### 🏢 Filiallar
| Method | Endpoint         | Ruxsat        |
|--------|-----------------|---------------|
| GET    | /branches        | super_admin   |
| POST   | /branches        | super_admin   |
| GET    | /branches/:id    | admin+        |
| PUT    | /branches/:id    | super_admin   |

### 👥 Foydalanuvchilar
| Method | Endpoint       |
|--------|---------------|
| GET    | /users         |
| POST   | /users         |
| PUT    | /users/:id     |

### 📚 Fanlar
| Method | Endpoint        |
|--------|----------------|
| GET    | /subjects       |
| POST   | /subjects       |

### 👩‍🏫 O'qituvchilar
| Method | Endpoint          |
|--------|------------------|
| GET    | /teachers         |
| POST   | /teachers         |
| GET    | /teachers/:id     |
| PUT    | /teachers/:id     |

### 👥 Guruhlar
| Method | Endpoint                          |
|--------|----------------------------------|
| GET    | /groups                           |
| POST   | /groups                           |
| GET    | /groups/:id                       |
| PUT    | /groups/:id                       |
| POST   | /groups/:id/students              |
| DELETE | /groups/:id/students/:student_id  |

### 🎓 Talabalar
| Method | Endpoint                      |
|--------|------------------------------|
| GET    | /students                     |
| POST   | /students                     |
| GET    | /students/:id                 |
| PUT    | /students/:id                 |
| DELETE | /students/:id (soft)          |
| GET    | /students/:id/groups          |
| POST   | /students/:id/groups          |

### 💳 To'lovlar
| Method | Endpoint                       |
|--------|-------------------------------|
| GET    | /payments                      |
| POST   | /payments                      |
| GET    | /payments/:id                  |
| PUT    | /payments/:id                  |
| POST   | /payments/generate-monthly     |
| GET    | /payments/report/debtors       |

### ✅ Davomat
| Method | Endpoint                          |
|--------|----------------------------------|
| GET    | /lessons                          |
| POST   | /lessons                          |
| POST   | /lessons/:id/attendance           |
| GET    | /lessons/report/attendance        |

### 📋 Arizalar (Leads)
| Method | Endpoint                  |
|--------|--------------------------|
| GET    | /leads                    |
| POST   | /leads                    |
| GET    | /leads/:id                |
| PUT    | /leads/:id                |
| DELETE | /leads/:id                |
| POST   | /leads/:id/convert        |
| GET    | /leads/:id/history        |
| GET    | /leads/funnel             |

### 📊 Dashboard
| Method | Endpoint      |
|--------|--------------|
| GET    | /dashboard    |

---

## Deploy (Production)

### VPS (Ubuntu 22.04)

```bash
# 1. Docker o'rnatish
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Kodni serverga yuklash
scp -r educrm-api/ user@your-server:/app/

# 3. .env ni to'ldirish (muhim!)
nano /app/educrm-api/.env
# APP_ENV=production
# JWT_SECRET=<64+ belgili tasodifiy satr>
# DB_PASSWORD=<kuchli parol>
# ALLOWED_ORIGINS=https://your-frontend.uz

# 4. Ishga tushirish
cd /app/educrm-api
docker compose up -d --build

# 5. Log ko'rish
docker compose logs -f api
```

### SSL (Let's Encrypt)
```bash
apt install certbot
certbot certonly --standalone -d api.yourdomain.uz
# Sertifikatlarni nginx/certs/ ga ko'chiring
```

---

## Frontend bilan ulash

```js
// src/api/client.js
const API = "http://localhost:8000/api/v1";

async function login(phone, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  localStorage.setItem("token", data.access_token);
  return data;
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).then(r => r.json());
}

// Misol: talabalar ro'yxati
const students = await apiFetch("/students?page=1&limit=20");
```

---

## Muhim xavfsizlik

1. `.env` faylni hech qachon git ga push qilmang
2. `JWT_SECRET` ni kamida 64 belgili qiling: `openssl rand -hex 32`
3. `DB_PASSWORD` ni kuchli parol bilan almashtiring
4. Production da `APP_DEBUG=false` qiling
5. `ALLOWED_ORIGINS` ga faqat o'z domeningizni yozing
