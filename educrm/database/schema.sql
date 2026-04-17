-- ============================================================
--  EduCRM — PostgreSQL Database Schema
--  Version: 1.0
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── BRANCHES (Filiallar) ─────────────────────────────────────
CREATE TABLE branches (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  address     VARCHAR(255),
  phone       VARCHAR(20),
  city        VARCHAR(100)  DEFAULT 'Toshkent',
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── USERS (Foydalanuvchilar) ─────────────────────────────────
CREATE TYPE user_role AS ENUM (
  'super_admin',   -- Barcha filiallarni boshqaradi
  'admin',         -- Bir filialning admini
  'manager',       -- Menejer
  'teacher',       -- O'qituvchi
  'cashier'        -- Kassir (faqat to'lovlar)
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER       REFERENCES branches(id) ON DELETE SET NULL,
  full_name     VARCHAR(150)  NOT NULL,
  phone         VARCHAR(20)   UNIQUE NOT NULL,
  email         VARCHAR(150)  UNIQUE,
  password_hash TEXT          NOT NULL,
  role          user_role     NOT NULL DEFAULT 'manager',
  avatar_url    TEXT,
  is_active     BOOLEAN       DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── SUBJECTS (Fanlar) ────────────────────────────────────────
CREATE TABLE subjects (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7),   -- HEX rang (#1D9E75)
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── TEACHERS (O'qituvchilar) ─────────────────────────────────
CREATE TYPE salary_type AS ENUM ('percent', 'fixed');

CREATE TABLE teachers (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  branch_id     INTEGER       NOT NULL REFERENCES branches(id),
  full_name     VARCHAR(150)  NOT NULL,
  phone         VARCHAR(20)   NOT NULL,
  subject_id    INTEGER       REFERENCES subjects(id),
  salary_type   salary_type   NOT NULL DEFAULT 'percent',
  salary_value  NUMERIC(12,2) NOT NULL DEFAULT 30,  -- % yoki so'm
  rating        NUMERIC(3,1)  DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  bio           TEXT,
  is_active     BOOLEAN       DEFAULT TRUE,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── ROOMS (Xonalar) ──────────────────────────────────────────
CREATE TABLE rooms (
  id         SERIAL PRIMARY KEY,
  branch_id  INTEGER      NOT NULL REFERENCES branches(id),
  name       VARCHAR(50)  NOT NULL,   -- "Xona 1", "A-101"
  capacity   INTEGER      NOT NULL DEFAULT 20,
  is_active  BOOLEAN      DEFAULT TRUE
);

-- ─── GROUPS (Guruhlar) ────────────────────────────────────────
CREATE TYPE group_level AS ENUM (
  'beginner', 'elementary', 'pre_intermediate',
  'intermediate', 'upper_intermediate', 'advanced'
);

CREATE TABLE groups (
  id           SERIAL PRIMARY KEY,
  branch_id    INTEGER       NOT NULL REFERENCES branches(id),
  teacher_id   INTEGER       NOT NULL REFERENCES teachers(id),
  subject_id   INTEGER       REFERENCES subjects(id),
  room_id      INTEGER       REFERENCES rooms(id),
  name         VARCHAR(100)  NOT NULL,
  level        group_level,
  capacity     INTEGER       NOT NULL DEFAULT 15,
  monthly_fee  NUMERIC(12,2) NOT NULL DEFAULT 500000,
  schedule     JSONB,        -- {"days":["mon","wed","fri"],"time":"10:00"}
  start_date   DATE,
  end_date     DATE,
  is_active    BOOLEAN       DEFAULT TRUE,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── STUDENTS (Talabalar) ─────────────────────────────────────
CREATE TYPE student_status AS ENUM ('new', 'active', 'stopped', 'graduated');

CREATE TABLE students (
  id              SERIAL PRIMARY KEY,
  branch_id       INTEGER       NOT NULL REFERENCES branches(id),
  full_name       VARCHAR(150)  NOT NULL,
  phone           VARCHAR(20)   NOT NULL,
  parent_phone    VARCHAR(20),
  birth_date      DATE,
  address         TEXT,
  photo_url       TEXT,
  status          student_status NOT NULL DEFAULT 'new',
  notes           TEXT,
  referral_source VARCHAR(100), -- 'instagram', 'telegram', 'friend', ...
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── STUDENT–GROUP (Ko'p-ko'p) ───────────────────────────────
CREATE TABLE student_groups (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id    INTEGER     NOT NULL REFERENCES groups(id)   ON DELETE CASCADE,
  joined_at   DATE        NOT NULL DEFAULT CURRENT_DATE,
  left_at     DATE,                   -- NULL = hali aktiv
  is_active   BOOLEAN     DEFAULT TRUE,
  UNIQUE (student_id, group_id)
);

-- ─── PAYMENTS (To'lovlar) ─────────────────────────────────────
CREATE TYPE payment_status AS ENUM ('paid', 'debt', 'pending', 'refunded');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'payme', 'click', 'uzum', 'transfer');

CREATE TABLE payments (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER         NOT NULL REFERENCES branches(id),
  student_id    INTEGER         NOT NULL REFERENCES students(id),
  group_id      INTEGER         REFERENCES groups(id),
  created_by    INTEGER         REFERENCES users(id),   -- Kassir / Admin
  amount        NUMERIC(12,2)   NOT NULL,
  discount      NUMERIC(12,2)   DEFAULT 0,
  final_amount  NUMERIC(12,2)   GENERATED ALWAYS AS (amount - discount) STORED,
  method        payment_method  NOT NULL DEFAULT 'cash',
  status        payment_status  NOT NULL DEFAULT 'pending',
  period_month  INTEGER         NOT NULL,  -- 1–12
  period_year   INTEGER         NOT NULL,  -- 2025
  paid_at       TIMESTAMPTZ,
  notes         TEXT,
  receipt_no    VARCHAR(50)     UNIQUE,
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     DEFAULT NOW()
);

-- ─── ATTENDANCE (Davomat) ─────────────────────────────────────
CREATE TYPE att_status AS ENUM ('present', 'absent', 'excused', 'late');

CREATE TABLE lessons (
  id          SERIAL PRIMARY KEY,
  group_id    INTEGER     NOT NULL REFERENCES groups(id),
  teacher_id  INTEGER     NOT NULL REFERENCES teachers(id),
  room_id     INTEGER     REFERENCES rooms(id),
  lesson_date DATE        NOT NULL,
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  topic       TEXT,
  is_cancelled BOOLEAN    DEFAULT FALSE,
  cancel_reason TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance (
  id          SERIAL PRIMARY KEY,
  lesson_id   INTEGER     NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  student_id  INTEGER     NOT NULL REFERENCES students(id),
  status      att_status  NOT NULL DEFAULT 'present',
  note        TEXT,
  marked_by   INTEGER     REFERENCES users(id),
  marked_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lesson_id, student_id)
);

-- ─── LEADS / ARIZALAR ─────────────────────────────────────────
CREATE TYPE lead_stage AS ENUM (
  'new',          -- Yangi
  'called',       -- Qo'ng'iroq qilindi
  'trial',        -- Sinov darsi
  'enrolled',     -- Ro'yxatdan o'tdi
  'rejected'      -- Rad etdi
);

CREATE TYPE lead_source AS ENUM (
  'instagram', 'telegram', 'referral',
  'advertisement', 'website', 'walk_in', 'other'
);

CREATE TABLE leads (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER      NOT NULL REFERENCES branches(id),
  assigned_to   INTEGER      REFERENCES users(id),
  full_name     VARCHAR(150) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  course_interest VARCHAR(100),
  source        lead_source  NOT NULL DEFAULT 'other',
  stage         lead_stage   NOT NULL DEFAULT 'new',
  notes         TEXT,
  trial_date    DATE,
  converted_student_id INTEGER REFERENCES students(id),  -- enrolled bo'lganda
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Lead holat o'zgarish tarixi
CREATE TABLE lead_history (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  changed_by  INTEGER      REFERENCES users(id),
  from_stage  lead_stage,
  to_stage    lead_stage   NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── TEACHER SALARY LOG ───────────────────────────────────────
CREATE TABLE salary_payments (
  id           SERIAL PRIMARY KEY,
  teacher_id   INTEGER       NOT NULL REFERENCES teachers(id),
  branch_id    INTEGER       NOT NULL REFERENCES branches(id),
  paid_by      INTEGER       REFERENCES users(id),
  amount       NUMERIC(12,2) NOT NULL,
  period_month INTEGER       NOT NULL,
  period_year  INTEGER       NOT NULL,
  method       payment_method NOT NULL DEFAULT 'cash',
  notes        TEXT,
  paid_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
CREATE TYPE notif_type AS ENUM (
  'payment_due', 'payment_received', 'attendance_low',
  'group_full', 'new_lead', 'birthday', 'custom'
);

CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  branch_id   INTEGER      REFERENCES branches(id),
  user_id     INTEGER      REFERENCES users(id),    -- NULL = barcha
  type        notif_type   NOT NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  is_read     BOOLEAN      DEFAULT FALSE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── TELEGRAM BOT ─────────────────────────────────────────────
CREATE TABLE telegram_subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id)   ON DELETE CASCADE,
  student_id  INTEGER      REFERENCES students(id) ON DELETE CASCADE,
  chat_id     BIGINT       NOT NULL UNIQUE,
  username    VARCHAR(100),
  is_active   BOOLEAN      DEFAULT TRUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR student_id IS NOT NULL)
);

-- ============================================================
--  INDEXES
-- ============================================================
CREATE INDEX idx_students_branch     ON students(branch_id);
CREATE INDEX idx_students_status     ON students(status);
CREATE INDEX idx_student_groups_grp  ON student_groups(group_id);
CREATE INDEX idx_student_groups_stu  ON student_groups(student_id);
CREATE INDEX idx_payments_student    ON payments(student_id);
CREATE INDEX idx_payments_period     ON payments(period_year, period_month);
CREATE INDEX idx_payments_status     ON payments(status);
CREATE INDEX idx_attendance_lesson   ON attendance(lesson_id);
CREATE INDEX idx_attendance_student  ON attendance(student_id);
CREATE INDEX idx_lessons_group_date  ON lessons(group_id, lesson_date);
CREATE INDEX idx_leads_branch_stage  ON leads(branch_id, stage);
CREATE INDEX idx_leads_created       ON leads(created_at DESC);

-- ============================================================
--  VIEWS
-- ============================================================

-- Monthly revenue per branch
CREATE VIEW v_monthly_revenue AS
SELECT
  p.branch_id,
  p.period_year,
  p.period_month,
  SUM(p.final_amount) FILTER (WHERE p.status = 'paid') AS total_paid,
  SUM(p.final_amount) FILTER (WHERE p.status = 'debt') AS total_debt,
  COUNT(*)            FILTER (WHERE p.status = 'paid') AS paid_count,
  COUNT(*)            FILTER (WHERE p.status = 'debt') AS debt_count
FROM payments p
GROUP BY p.branch_id, p.period_year, p.period_month;

-- Student attendance rate
CREATE VIEW v_student_attendance AS
SELECT
  a.student_id,
  sg.group_id,
  COUNT(*)                                          AS total_lessons,
  COUNT(*) FILTER (WHERE a.status = 'present')     AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'absent')      AS absent_count,
  COUNT(*) FILTER (WHERE a.status = 'excused')     AS excused_count,
  ROUND(
    COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0),
    1
  ) AS attendance_pct
FROM attendance a
JOIN lessons l ON l.id = a.lesson_id
JOIN student_groups sg ON sg.student_id = a.student_id AND sg.group_id = l.group_id
GROUP BY a.student_id, sg.group_id;

-- Group fill rate
CREATE VIEW v_group_capacity AS
SELECT
  g.id,
  g.name,
  g.capacity,
  COUNT(sg.student_id) FILTER (WHERE sg.is_active = TRUE) AS current_count,
  ROUND(
    COUNT(sg.student_id) FILTER (WHERE sg.is_active = TRUE) * 100.0 / NULLIF(g.capacity, 0),
    1
  ) AS fill_pct
FROM groups g
LEFT JOIN student_groups sg ON sg.group_id = g.id
GROUP BY g.id, g.name, g.capacity;

-- Lead conversion funnel
CREATE VIEW v_lead_funnel AS
SELECT
  branch_id,
  stage,
  COUNT(*) AS lead_count,
  ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY branch_id), 0), 1) AS pct
FROM leads
GROUP BY branch_id, stage;

-- ============================================================
--  FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-log lead stage changes
CREATE OR REPLACE FUNCTION log_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO lead_history (lead_id, from_stage, to_stage)
    VALUES (NEW.id, OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lead_stage_log
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION log_lead_stage_change();

-- Auto-generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_no IS NULL THEN
    NEW.receipt_no = 'REC-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEW.id::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_receipt
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_receipt_no();

-- ============================================================
--  SEED DATA (namuna ma'lumotlar)
-- ============================================================

INSERT INTO branches (name, address, phone, city) VALUES
  ('Filial 1 — Chilonzor', 'Chilonzor ko''chasi 5-uy', '+998 71 123 45 67', 'Toshkent'),
  ('Filial 2 — Yunusobod', 'Amir Temur shoh ko''chasi 108', '+998 71 234 56 78', 'Toshkent'),
  ('Filial 3 — Mirzo Ulug''bek', 'Mirzo Ulug''bek ko''chasi 22', '+998 71 345 67 89', 'Toshkent');

INSERT INTO subjects (name, color) VALUES
  ('English',     '#378ADD'),
  ('IELTS',       '#BA7517'),
  ('Mathematics', '#7F77DD'),
  ('Russian',     '#639922'),
  ('IT',          '#1D9E75');

INSERT INTO users (branch_id, full_name, phone, password_hash, role) VALUES
  (NULL, 'Super Admin', '+998 90 000 00 01', crypt('admin123', gen_salt('bf')), 'super_admin'),
  (1,    'Filial 1 Admin', '+998 90 000 00 02', crypt('admin123', gen_salt('bf')), 'admin'),
  (2,    'Filial 2 Admin', '+998 90 000 00 03', crypt('admin123', gen_salt('bf')), 'admin'),
  (3,    'Filial 3 Admin', '+998 90 000 00 04', crypt('admin123', gen_salt('bf')), 'admin');
