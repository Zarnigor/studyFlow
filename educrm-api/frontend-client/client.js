/**
 * EduCRM — API Client
 * src/api/client.js
 *
 * Ishlatish:
 *   import { api } from "@/api/client";
 *   const students = await api.students.list({ page: 1, limit: 20 });
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// ── Token helpers ──────────────────────────────────────────────
const tokens = {
  get access()  { return localStorage.getItem("access_token"); },
  get refresh() { return localStorage.getItem("refresh_token"); },
  set(access, refresh) {
    localStorage.setItem("access_token",  access);
    localStorage.setItem("refresh_token", refresh);
  },
  clear() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
};

// ── Core fetch wrapper ─────────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function request(path, options = {}) {
  const url     = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (tokens.access) headers["Authorization"] = `Bearer ${tokens.access}`;

  const res = await fetch(url, { ...options, headers });

  // Token expired — try refresh once
  if (res.status === 401 && tokens.refresh && !options._retry) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const r = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: tokens.refresh }),
        });
        const data = await r.json();
        if (r.ok) {
          tokens.set(data.access_token, data.refresh_token);
          refreshQueue.forEach(cb => cb(data.access_token));
          refreshQueue = [];
        } else {
          tokens.clear();
          window.dispatchEvent(new Event("auth:logout"));
        }
      } finally {
        isRefreshing = false;
      }
    } else {
      await new Promise(resolve => refreshQueue.push(resolve));
    }
    return request(path, { ...options, _retry: true });
  }

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw Object.assign(new Error(err?.error?.message ?? "Request failed"), { status: res.status, data: err });
  }

  if (res.status === 204) return null;
  return res.json();
}

const get    = (path, params)        => request(buildUrl(path, params));
const post   = (path, body)          => request(path, { method: "POST",   body: JSON.stringify(body) });
const put    = (path, body)          => request(path, { method: "PUT",    body: JSON.stringify(body) });
const del    = (path)                => request(path, { method: "DELETE" });

function buildUrl(path, params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""));
  const qs    = new URLSearchParams(clean).toString();
  return qs ? `${path}?${qs}` : path;
}


// ── API namespaces ─────────────────────────────────────────────
export const api = {

  // Auth
  auth: {
    login:   (phone, password)   => post("/auth/login", { phone, password }),
    refresh: (refresh_token)     => post("/auth/refresh", { refresh_token }),
    me:      ()                  => get("/auth/me"),
  },

  // Branches
  branches: {
    list:   ()              => get("/branches"),
    get:    (id)            => get(`/branches/${id}`),
    create: (data)          => post("/branches", data),
    update: (id, data)      => put(`/branches/${id}`, data),
  },

  // Users
  users: {
    list:   (params = {})   => get("/users", params),
    create: (data)          => post("/users", data),
    update: (id, data)      => put(`/users/${id}`, data),
  },

  // Subjects
  subjects: {
    list:   ()              => get("/subjects"),
    create: (data)          => post("/subjects", data),
  },

  // Teachers
  teachers: {
    list:   (params = {})   => get("/teachers", params),
    get:    (id)            => get(`/teachers/${id}`),
    create: (data)          => post("/teachers", data),
    update: (id, data)      => put(`/teachers/${id}`, data),
  },

  // Groups
  groups: {
    list:          (params = {})          => get("/groups", params),
    get:           (id)                   => get(`/groups/${id}`),
    create:        (data)                 => post("/groups", data),
    update:        (id, data)             => put(`/groups/${id}`, data),
    addStudent:    (groupId, studentId)   => post(`/groups/${groupId}/students`,           { group_id: studentId }),
    removeStudent: (groupId, studentId)   => del(`/groups/${groupId}/students/${studentId}`),
  },

  // Students
  students: {
    list:         (params = {})      => get("/students", params),
    get:          (id)               => get(`/students/${id}`),
    create:       (data)             => post("/students", data),
    update:       (id, data)         => put(`/students/${id}`, data),
    deactivate:   (id)               => del(`/students/${id}`),
    groups:       (id)               => get(`/students/${id}/groups`),
    enroll:       (id, group_id)     => post(`/students/${id}/groups`, { group_id }),
  },

  // Payments
  payments: {
    list:             (params = {})  => get("/payments", params),
    get:              (id)           => get(`/payments/${id}`),
    create:           (data)         => post("/payments", data),
    update:           (id, data)     => put(`/payments/${id}`, data),
    generateMonthly:  (data)         => post("/payments/generate-monthly", data),
    debtors:          (params = {})  => get("/payments/report/debtors", params),
  },

  // Lessons & Attendance
  lessons: {
    list:          (params = {})           => get("/lessons", params),
    create:        (data)                  => post("/lessons", data),
    markAttendance:(lessonId, entries)     => post(`/lessons/${lessonId}/attendance`, { entries }),
    report:        (group_id, month, year) => get("/lessons/report/attendance", { group_id, month, year }),
  },

  // Leads
  leads: {
    list:    (params = {}) => get("/leads", params),
    get:     (id)          => get(`/leads/${id}`),
    create:  (data)        => post("/leads", data),
    update:  (id, data)    => put(`/leads/${id}`, data),
    delete:  (id)          => del(`/leads/${id}`),
    convert: (id, group_id)=> post(`/leads/${id}/convert`, { group_id }),
    history: (id)          => get(`/leads/${id}/history`),
    funnel:  (params = {}) => get("/leads/funnel", params),
  },

  // Dashboard
  dashboard: {
    get: (branch_id) => get("/dashboard", branch_id ? { branch_id } : {}),
  },

  // Telegram
  telegram: {
    stats:        ()           => get("/telegram/stats"),
    sendReminders:(branch_id)  => post("/telegram/send-reminders", { branch_id }),
    broadcast:    (text, bid)  => post("/telegram/broadcast", { text, branch_id: bid }),
  },
};


// ── Auth service (use in App.jsx) ──────────────────────────────
export const authService = {
  async login(phone, password) {
    const data = await api.auth.login(phone, password);
    tokens.set(data.access_token, data.refresh_token);
    return data.user;
  },
  logout() {
    tokens.clear();
    window.dispatchEvent(new Event("auth:logout"));
  },
  isLoggedIn: () => !!tokens.access,
  getUser:    () => api.auth.me(),
};
