const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

// ── token storage ──────────────────────────────────────────────
const tok = {
  get access()  { return localStorage.getItem("sf_access"); },
  get refresh() { return localStorage.getItem("sf_refresh"); },
  set(a, r)     { localStorage.setItem("sf_access", a); localStorage.setItem("sf_refresh", r); },
  clear()       { localStorage.removeItem("sf_access"); localStorage.removeItem("sf_refresh"); },
};

// ── core fetch ─────────────────────────────────────────────────
let refreshing = false;
let queue = [];

async function req(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (tok.access) headers["Authorization"] = `Bearer ${tok.access}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (res.status === 401 && tok.refresh && !opts._retry) {
    if (!refreshing) {
      refreshing = true;
      try {
        const r = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: tok.refresh }),
        });
        if (r.ok) {
          const d = await r.json();
          tok.set(d.access_token, d.refresh_token);
          queue.forEach(fn => fn());
          queue = [];
        } else {
          tok.clear();
          window.dispatchEvent(new Event("auth:expired"));
          return;
        }
      } finally { refreshing = false; }
    } else {
      await new Promise(resolve => queue.push(resolve));
    }
    return req(path, { ...opts, _retry: true });
  }

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const detail = data?.detail;
    const msg = data?.error?.message
      ?? (Array.isArray(detail)
          ? detail.map(e => `${e.loc?.slice(-1)[0]}: ${e.msg}`).join(", ")
          : (typeof detail === "string" ? detail : null))
      ?? res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

const get  = (path, params) => {
  const qs = params ? "?" + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ""))
  ) : "";
  return req(path + qs);
};
const post = (path, body) => req(path, { method: "POST",   body: JSON.stringify(body) });
const put  = (path, body) => req(path, { method: "PUT",    body: JSON.stringify(body) });
const del  = (path)       => req(path, { method: "DELETE" });

// ── API ────────────────────────────────────────────────────────
export const api = {
  auth: {
    login:   (phone, password)  => post("/auth/login", { phone, password }),
    refresh: (refresh_token)    => post("/auth/refresh", { refresh_token }),
    me:      ()                 => get("/auth/me"),
  },
  branches: {
    list:   ()             => get("/branches"),
    create: (d)            => post("/branches", d),
    update: (id, d)        => put(`/branches/${id}`, d),
  },
  students: {
    list:   (p = {})       => get("/students", p),
    get:    (id)           => get(`/students/${id}`),
    create: (d)            => post("/students", d),
    update: (id, d)        => put(`/students/${id}`, d),
    delete: (id)           => del(`/students/${id}`),
  },
  groups: {
    list:          (p = {})       => get("/groups", p),
    get:           (id)           => get(`/groups/${id}`),
    create:        (d)            => post("/groups", d),
    update:        (id, d)        => put(`/groups/${id}`, d),
    addStudent:     (gid, sid)     => post(`/groups/${gid}/students`, { student_id: sid }),
    removeStudent:  (gid, sid)    => del(`/groups/${gid}/students/${sid}`),
    assignTeacher:  (gid, tid)    => put(`/groups/${gid}/teacher`, { teacher_id: tid }),
  },
  payments: {
    list:            (p = {})     => get("/payments", p),
    create:          (d)          => post("/payments", d),
    update:          (id, d)      => put(`/payments/${id}`, d),
    generateMonthly: (d)          => post("/payments/generate-monthly", d),
    debtors:         (p = {})     => get("/payments/report/debtors", p),
  },
  teachers: {
    list:   (p = {})       => get("/teachers", p),
    get:    (id)           => get(`/teachers/${id}`),
    create: (d)            => post("/teachers", d),
    update: (id, d)        => put(`/teachers/${id}`, d),
    delete: (id)           => del(`/teachers/${id}`),
  },
  lessons: {
    list:            (p = {})            => get("/lessons", p),
    get:             (id)                => get(`/lessons/${id}`),
    create:          (d)                 => post("/lessons", d),
    update:          (id, d)             => put(`/lessons/${id}`, d),
    delete:          (id)                => del(`/lessons/${id}`),
    markAttendance:  (lid, entries)      => post(`/lessons/${lid}/attendance`, { entries }),
    report:          (group_id, m, y)    => get("/lessons/report/attendance", { group_id, month: m, year: y }),
    statsByGroup:    (p = {})            => get("/lessons/stats/by-group", p),
  },
  leads: {
    list:    (p = {})      => get("/leads", p),
    get:     (id)          => get(`/leads/${id}`),
    create:  (d)           => post("/leads", d),
    update:  (id, d)       => put(`/leads/${id}`, d),
    delete:  (id)          => del(`/leads/${id}`),
    convert: (id, gid)     => post(`/leads/${id}/convert`, { group_id: gid }),
    funnel:  (p = {})      => get("/leads/funnel", p),
  },
  dashboard: {
    get: (branch_id)       => get("/dashboard", branch_id ? { branch_id } : {}),
  },
  subjects: {
    list:   ()    => get("/subjects"),
    create: (d)   => post("/subjects", d),
  },
  users: {
    list:           (p = {})        => get("/users", p),
    create:         (d)             => post("/users", d),
    update:         (id, d)         => put(`/users/${id}`, d),
    changePassword: (id, password)  => put(`/users/${id}/change-password`, { password }),
  },
};

export { tok as tokens };
// already exported via api.users.update — password change uses same endpoint
