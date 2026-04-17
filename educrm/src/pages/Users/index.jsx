import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useLang } from "../../i18n/LangContext";
import { api } from "../../api/client";
import { NoAccess, Button, Modal, FormField, Input, Select, ModalButtons, Badge } from "../../components/ui";

const ROLE_BADGE_STYLE = {
  super_admin: { background: "#E1F5EE", color: "#085041" },
  admin:       { background: "#E6F1FB", color: "#0C447C" },
  manager:     { background: "#EEEDFE", color: "#3C3489" },
  teacher:     { background: "#FDEDF4", color: "#7C1542" },
  cashier:     { background: "#FAEEDA", color: "#633806" },
};

const AVATAR_COLORS = ["#1D9E75","#378ADD","#7F77DD","#D4537E","#BA7517","#639922","#85B7EB"];

function initials(name) {
  return (name ?? "").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "??";
}
function avatarColor(id) {
  return AVATAR_COLORS[(id ?? 0) % AVATAR_COLORS.length];
}

export default function Users() {
  const { isSuperAdmin, branchId } = useAuth();
  const P = usePermissions();
  const { lang } = useLang();
  const isUz = lang !== "en";

  if (!P.canManageUsers) return <NoAccess message={isUz ? "Bu bo'limga ruxsatingiz yo'q" : "You don't have access to this section"} />;

  const ROLE_LABELS = {
    super_admin: "Super Admin",
    admin:       "Admin",
    manager:     isUz ? "Menejer" : "Manager",
    teacher:     isUz ? "O'qituvchi" : "Teacher",
    cashier:     isUz ? "Kassir" : "Cashier",
  };

  const CREATABLE_ROLES = [
    { value: "admin",   label: "Admin" },
    { value: "manager", label: isUz ? "Menejer" : "Manager" },
    { value: "teacher", label: isUz ? "O'qituvchi" : "Teacher" },
    { value: "cashier", label: isUz ? "Kassir" : "Cashier" },
  ];

  const [users,    setUsers]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "", phone: "", password: "studyflow123", role: "manager", branch_id: "",
  });

  const [editOpen,   setEditOpen]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm,   setEditForm]   = useState({ full_name: "", role: "manager", password: "" });

  useEffect(() => {
    loadUsers();
    if (isSuperAdmin) loadBranches();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.users.list({});
      setUsers(res?.data ?? res ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    try {
      const res = await api.branches.list();
      setBranches(res?.data ?? res ?? []);
    } catch { /* ignore */ }
  }

  async function handleCreate() {
    const { full_name, phone, password, role } = createForm;
    if (!full_name || !phone || !role) return;
    const branch_id = isSuperAdmin ? createForm.branch_id : branchId;
    setCreating(true);
    try {
      await api.users.create({ full_name, phone, password, role, branch_id });
      setCreateOpen(false);
      setCreateForm({ full_name: "", phone: "", password: "studyflow123", role: "manager", branch_id: "" });
      await loadUsers();
    } catch (e) {
      alert(e.message ?? (isUz ? "Xatolik yuz berdi" : "Error occurred"));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u) {
    setEditTarget(u);
    setEditForm({ full_name: u.full_name, role: u.role, password: "" });
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editTarget) return;
    const payload = { full_name: editForm.full_name, role: editForm.role };
    if (editForm.password) payload.password = editForm.password;
    setEditing(true);
    try {
      await api.users.update(editTarget.id, payload);
      setEditOpen(false);
      setEditTarget(null);
      await loadUsers();
    } catch (e) {
      alert(e.message ?? (isUz ? "Xatolik yuz berdi" : "Error occurred"));
    } finally {
      setEditing(false);
    }
  }

  async function handleDeactivate(u) {
    const confirmMsg = isUz
      ? `"${u.full_name}" ni deaktivatsiya qilmoqchimisiz?`
      : `Deactivate "${u.full_name}"?`;
    if (!confirm(confirmMsg)) return;
    try {
      await api.users.update(u.id, { is_active: false });
      await loadUsers();
    } catch (e) {
      alert(e.message ?? (isUz ? "Xatolik yuz berdi" : "Error occurred"));
    }
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const activeUsers = users.filter(u => u.is_active !== false);
  const roleCounts  = CREATABLE_ROLES.map(r => ({
    ...r,
    count: users.filter(u => u.role === r.value).length,
  }));

  function branchName(branch_id) {
    if (!branch_id) return "—";
    const b = branches.find(b => b.id === branch_id);
    return b?.name ?? String(branch_id);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", background: "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{isUz ? "Foydalanuvchilar" : "Users"}</span>
        <Button onClick={() => setCreateOpen(true)} style={{ marginLeft: "auto" }}>
          {isUz ? "+ Foydalanuvchi qo'shish" : "+ Add User"}
        </Button>
      </div>

      <div style={{ flex: 1, padding: "14px 16px", overflowY: "auto", background: "var(--color-background-tertiary)", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "10px 13px" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 3, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>
              {isUz ? "Jami aktiv" : "Total active"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1 }}>{activeUsers.length}</div>
          </div>
          {roleCounts.map(r => (
            <div key={r.value} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 10, padding: "10px 13px" }}>
              <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 3, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>{r.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1 }}>{r.count}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "5px 10px" }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isUz ? "Qidirish..." : "Search..."}
              style={{ border: "none", background: "none", outline: "none", fontSize: 12, color: "var(--color-text-primary)", fontFamily: "var(--font-sans)", width: 180 }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{filtered.length} ta</span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--color-text-secondary)", fontSize: 12 }}>
            {isUz ? "Yuklanmoqda..." : "Loading..."}
          </div>
        ) : (
          <div style={{ background: "var(--color-background-primary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["", isUz ? "Foydalanuvchi" : "User", isUz ? "Telefon" : "Phone", isUz ? "Rol" : "Role", isUz ? "Filial" : "Branch", isUz ? "Holat" : "Status", isUz ? "Amallar" : "Actions"].map((h, i) => (
                    <th key={i} style={{ textAlign: "left", padding: "7px 11px", fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500, borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 30, textAlign: "center", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {isUz ? "Foydalanuvchi topilmadi" : "No users found"}
                    </td>
                  </tr>
                )}
                {filtered.map(u => (
                  <tr key={u.id}
                    style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", transition: "background .1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = ""}>

                    {/* Avatar */}
                    <td style={{ padding: "7px 11px", width: 36 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(u.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "#fff", flexShrink: 0 }}>
                        {initials(u.full_name)}
                      </div>
                    </td>

                    {/* Full name */}
                    <td style={{ padding: "7px 11px", fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>
                      {u.full_name}
                    </td>

                    {/* Phone */}
                    <td style={{ padding: "7px 11px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {u.phone}
                    </td>

                    {/* Role badge */}
                    <td style={{ padding: "7px 11px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", ...(ROLE_BADGE_STYLE[u.role] ?? {}) }}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>

                    {/* Branch */}
                    <td style={{ padding: "7px 11px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {isSuperAdmin ? branchName(u.branch_id) : "—"}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "7px 11px" }}>
                      {u.is_active !== false
                        ? <Badge preset="green">{isUz ? "Aktiv" : "Active"}</Badge>
                        : <Badge preset="red">{isUz ? "Nofaol" : "Inactive"}</Badge>}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "7px 11px" }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        <Button variant="ghost" onClick={() => openEdit(u)} style={{ padding: "3px 9px", fontSize: 11 }}>
                          {isUz ? "Tahrirlash" : "Edit"}
                        </Button>
                        {u.is_active !== false && u.role !== "super_admin" && (
                          <Button variant="danger" onClick={() => handleDeactivate(u)} style={{ padding: "3px 9px", fontSize: 11 }}>
                            {isUz ? "O'chirish" : "Deactivate"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{isUz ? "Yangi foydalanuvchi" : "New User"}</div>
        <FormField label={isUz ? "ISM FAMILIYA" : "FULL NAME"}>
          <Input value={createForm.full_name} onChange={v => setCreateForm(p => ({ ...p, full_name: v }))} placeholder="Kamola Yusupova" />
        </FormField>
        <FormField label={isUz ? "TELEFON" : "PHONE"}>
          <Input value={createForm.phone} onChange={v => setCreateForm(p => ({ ...p, phone: v }))} placeholder="+998 90 000 00 00" />
        </FormField>
        <FormField label={isUz ? "PAROL" : "PASSWORD"}>
          <Input value={createForm.password} onChange={v => setCreateForm(p => ({ ...p, password: v }))} placeholder="studyflow123" />
        </FormField>
        <FormField label={isUz ? "ROL" : "ROLE"}>
          <Select value={createForm.role} onChange={v => setCreateForm(p => ({ ...p, role: v }))}>
            {CREATABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </FormField>
        {isSuperAdmin && (
          <FormField label={isUz ? "FILIAL" : "BRANCH"}>
            <Select value={createForm.branch_id} onChange={v => setCreateForm(p => ({ ...p, branch_id: v }))}>
              <option value="">{isUz ? "Filial tanlang" : "Select branch"}</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </FormField>
        )}
        <ModalButtons>
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>{isUz ? "Bekor qilish" : "Cancel"}</Button>
          <Button onClick={handleCreate} style={{ opacity: creating ? .6 : 1 }}>{creating ? "..." : (isUz ? "Saqlash" : "Save")}</Button>
        </ModalButtons>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{isUz ? "Tahrirlash" : "Edit User"}</div>
        <FormField label={isUz ? "ISM FAMILIYA" : "FULL NAME"}>
          <Input value={editForm.full_name} onChange={v => setEditForm(p => ({ ...p, full_name: v }))} />
        </FormField>
        <FormField label={isUz ? "ROL" : "ROLE"}>
          <Select value={editForm.role} onChange={v => setEditForm(p => ({ ...p, role: v }))}>
            {CREATABLE_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </FormField>
        <FormField label={isUz ? "PAROL" : "PASSWORD"}>
          <Input value={editForm.password} onChange={v => setEditForm(p => ({ ...p, password: v }))} placeholder={isUz ? "o'zgartirmaslik uchun bo'sh qoldiring" : "leave blank to keep unchanged"} />
        </FormField>
        <ModalButtons>
          <Button variant="ghost" onClick={() => setEditOpen(false)}>{isUz ? "Bekor qilish" : "Cancel"}</Button>
          <Button onClick={handleEdit} style={{ opacity: editing ? .6 : 1 }}>{editing ? "..." : (isUz ? "Saqlash" : "Save")}</Button>
        </ModalButtons>
      </Modal>
    </div>
  );
}