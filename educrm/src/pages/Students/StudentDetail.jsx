import { useState, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { api } from "../../api/client";

const STATUS_COLORS = {
  active:  { bg:"#E1F5EE", tc:"#085041" },
  stopped: { bg:"#FCEBEB", tc:"#791F1F" },
  new:     { bg:"#E6F1FB", tc:"#0C447C" },
};

const STATUS_LABEL = {
  active:  "Aktiv",
  stopped: "To'xtatilgan",
  new:     "Yangi",
};

function initials(n) {
  return (n ?? "").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "??";
}

function Section({ title, children }) {
  return (
    <div style={{
      background:"var(--color-background-primary)",
      border:"0.5px solid var(--color-border-tertiary)",
      borderRadius:10, overflow:"hidden", marginBottom:12,
    }}>
      <div style={{
        padding:"9px 14px",
        borderBottom:"0.5px solid var(--color-border-tertiary)",
        background:"var(--color-background-secondary)",
        fontSize:11, fontWeight:500,
        color:"var(--color-text-secondary)",
        textTransform:"uppercase", letterSpacing:".05em",
      }}>
        {title}
      </div>
      <div style={{ padding:14 }}>{children}</div>
    </div>
  );
}

export default function StudentDetail({ studentId, onBack }) {
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();

  const [student,         setStudent]         = useState(null);
  const [payments,        setPayments]        = useState([]);
  const [allGroups,       setAllGroups]       = useState([]);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [addGroupId,      setAddGroupId]      = useState("");
  const [addingGroup,     setAddingGroup]     = useState(false);
  const [editMode,        setEditMode]        = useState(false);
  const [editForm,        setEditForm]        = useState({});
  const [saving,          setSaving]          = useState(false);
  const [groupSearch,     setGroupSearch]     = useState("");

  async function load() {
    setLoading(true);
    try {
      const [stuRes, payRes, grpRes] = await Promise.all([
        api.students.get(studentId),
        api.payments.list({ student_id: studentId, limit: 50 }),
        api.groups.list(isSuperAdmin ? {} : { branch_id: branchId }),
      ]);

      const stu     = stuRes?.data ?? stuRes;
      const pays    = payRes?.data ?? [];
      const allGrps = Array.isArray(grpRes) ? grpRes : grpRes?.data ?? [];

      setStudent(stu);
      setPayments(pays);
      setAllGroups(allGrps);

      const enrolledGroupIds = new Set(
        allGrps
          .filter(g => (g.student_groups ?? []).some(sg => sg.student_id === studentId && sg.is_active))
          .map(g => g.id)
      );
      setAvailableGroups(allGrps.filter(g => !enrolledGroupIds.has(g.id)));
    } catch(e) {
      console.error("Student detail load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [studentId]);

  const enrolledGroups = allGroups.filter(g =>
    (g.student_groups ?? []).some(sg => sg.student_id === studentId && sg.is_active)
  );

  const filteredAvailableGroups = availableGroups.filter(g =>
    !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  async function handleAddGroup() {
    if (!addGroupId) return;
    setAddingGroup(true);
    try {
      await api.groups.addStudent(Number(addGroupId), studentId);
      setAddGroupId("");
      setGroupSearch("");
      await load();
    } catch(e) {
      alert(e.message ?? "Xatolik yuz berdi");
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleRemoveGroup(groupId) {
    if (!confirm("Bu guruhdan chiqarilsinmi?")) return;
    try {
      await api.groups.removeStudent(groupId, studentId);
      await load();
    } catch(e) {
      alert(e.message ?? "Xatolik");
    }
  }

  async function handleSave() {
    if (!editForm.full_name?.trim() || !editForm.phone?.trim()) {
      alert("Ism va telefon shart");
      return;
    }
    setSaving(true);
    try {
      await api.students.update(studentId, {
        full_name: editForm.full_name.trim(),
        phone:     editForm.phone.trim(),
        status:    editForm.status,
      });
      setEditMode(false);
      await load();
    } catch(e) {
      alert(e.message ?? "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  function fmt(n) {
    const num = parseFloat(n);
    if (!n || isNaN(num)) return "0";
    return Math.round(num).toLocaleString();
  }

  if (loading) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--color-background-tertiary)", color:"var(--color-text-secondary)", fontSize:13 }}>
        Yuklanmoqda...
      </div>
    );
  }

  if (!student) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", background:"var(--color-background-tertiary)", color:"var(--color-text-secondary)", fontSize:13 }}>
        Talaba topilmadi
      </div>
    );
  }

  const sc = STATUS_COLORS[student.status] ?? STATUS_COLORS.new;
  const ini = initials(student.full_name);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((a, p) => a + parseFloat(p.amount || 0), 0);
  const totalDebt = payments.filter(p => p.status === "debt").reduce((a, p) => a + parseFloat(p.amount || 0), 0);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        <button onClick={onBack}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)", display:"flex", alignItems:"center", gap:4, padding:0 }}>
          ← Talabalar
        </button>
        <span style={{ color:"var(--color-text-secondary)" }}>/</span>
        <span style={{ fontSize:14, fontWeight:500 }}>{student.full_name}</span>
        {P.students.canEdit && (
          <button
            onClick={() => { setEditMode(!editMode); setEditForm({ full_name: student.full_name, phone: student.phone, status: student.status }); }}
            style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--font-sans)", border:"0.5px solid var(--color-border-tertiary)", background:"none", color:"var(--color-text-secondary)" }}>
            {editMode ? "Bekor" : "✎ Tahrirlash"}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,320px)", gap:12, alignItems:"start" }}>

          {/* LEFT */}
          <div>

            {/* Profile card */}
            <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:16, marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom: editMode ? 14 : 0 }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:sc.bg, color:sc.tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:500, flexShrink:0 }}>
                  {ini}
                </div>
                {!editMode ? (
                  <div>
                    <div style={{ fontSize:15, fontWeight:500 }}>{student.full_name}</div>
                    <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>{student.phone}</div>
                    <div style={{ marginTop:5 }}>
                      <span style={{ background:sc.bg, color:sc.tc, padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:500 }}>
                        {STATUS_LABEL[student.status] ?? student.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                    <input
                      value={editForm.full_name}
                      onChange={e => setEditForm(p => ({...p, full_name: e.target.value}))}
                      style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none" }}
                    />
                    <input
                      value={editForm.phone}
                      onChange={e => setEditForm(p => ({...p, phone: e.target.value}))}
                      style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none" }}
                    />
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(p => ({...p, status: e.target.value}))}
                      style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:13, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none" }}>
                      <option value="active">Aktiv</option>
                      <option value="new">Yangi</option>
                      <option value="stopped">To'xtatilgan</option>
                    </select>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setEditMode(false)}
                        style={{ flex:1, padding:"7px", borderRadius:8, border:"0.5px solid var(--color-border-tertiary)", background:"none", fontSize:12, cursor:"pointer", fontFamily:"var(--font-sans)", color:"var(--color-text-secondary)" }}>
                        Bekor
                      </button>
                      <button onClick={handleSave} disabled={saving}
                        style={{ flex:2, padding:"7px", borderRadius:8, border:"none", background:saving ? "#5DCAA5" : "#1D9E75", color:"#fff", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"var(--font-sans)" }}>
                        {saving ? "..." : "Saqlash"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payments history */}
            <Section title="To'lovlar tarixi">
              {payments.length === 0 ? (
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", textAlign:"center", padding:"8px 0" }}>To'lov yo'q</div>
              ) : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    <div style={{ background:"#E1F5EE", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:"#1D9E75", marginBottom:2 }}>To'langan</div>
                      <div style={{ fontSize:16, fontWeight:500, color:"#085041" }}>{fmt(totalPaid)} so'm</div>
                    </div>
                    <div style={{ background:"#FCEBEB", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontSize:10, color:"#A32D2D", marginBottom:2 }}>Qarzdor</div>
                      <div style={{ fontSize:16, fontWeight:500, color:"#791F1F" }}>{fmt(totalDebt)} so'm</div>
                    </div>
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr>
                        {["Sana", "Summa", "Turi", "Holat"].map(h => (
                          <th key={h} style={{ textAlign:"left", padding:"5px 8px", fontSize:10, color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => {
                        const stc = { paid:{bg:"#E1F5EE",tc:"#085041"}, debt:{bg:"#FCEBEB",tc:"#791F1F"}, pending:{bg:"#FAEEDA",tc:"#633806"} }[p.status] ?? { bg:"var(--color-background-secondary)", tc:"var(--color-text-secondary)" };
                        return (
                          <tr key={p.id} style={{ borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                            <td style={{ padding:"6px 8px", color:"var(--color-text-secondary)" }}>{p.payment_date ?? `${p.period_month}/${p.period_year}`}</td>
                            <td style={{ padding:"6px 8px", fontWeight:500 }}>{fmt(p.amount)}</td>
                            <td style={{ padding:"6px 8px", color:"var(--color-text-secondary)" }}>{p.method}</td>
                            <td style={{ padding:"6px 8px" }}>
                              <span style={{ background:stc.bg, color:stc.tc, padding:"2px 7px", borderRadius:10, fontSize:10, fontWeight:500 }}>
                                {{ paid:"To'langan", debt:"Qarzdor", pending:"Kutilmoqda" }[p.status] ?? p.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </Section>
          </div>

          {/* RIGHT — Group management */}
          <div>
            <Section title="Guruhlar">

              {/* Current groups */}
              {enrolledGroups.length === 0 ? (
                <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:12 }}>
                  Hech qaysi guruhga qo'shilmagan
                </div>
              ) : (
                <div style={{ marginBottom:14, display:"flex", flexDirection:"column", gap:5 }}>
                  {enrolledGroups.map(g => (
                    <div key={g.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"#E1F5EE", borderRadius:8 }}>
                      <div style={{ fontSize:11, fontWeight:500, color:"#085041", flex:1 }}>{g.name}</div>
                      {g.teacher && <div style={{ fontSize:10, color:"#1D9E75" }}>{g.teacher.full_name}</div>}
                      {P.groups.canRemoveStudent && (
                        <button onClick={() => handleRemoveGroup(g.id)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#A32D2D", fontSize:14, lineHeight:1, padding:2 }}
                          title="Guruhdan chiqarish">
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add to group */}
              {P.groups.canAddStudent && availableGroups.length > 0 && (
                <>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:7, fontWeight:500 }}>
                    Guruhga qo'shish
                  </div>

                  {/* Search */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--color-background-secondary)", border:"0.5px solid var(--color-border-secondary)", borderRadius:7, padding:"5px 9px", marginBottom:6 }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
                      <circle cx="7" cy="7" r="5" stroke="var(--color-text-secondary)" strokeWidth="1.5"/>
                      <path d="M11 11l3 3" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <input
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                      placeholder="Guruh qidirish..."
                      style={{ flex:1, border:"none", background:"none", outline:"none", fontSize:11, color:"var(--color-text-primary)", fontFamily:"var(--font-sans)" }}
                    />
                    {groupSearch && (
                      <button onClick={() => setGroupSearch("")}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--color-text-secondary)", fontSize:14, lineHeight:1, padding:0 }}>
                        ×
                      </button>
                    )}
                  </div>

                  {/* Group list */}
                  <div style={{ maxHeight:180, overflowY:"auto", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8, marginBottom:8, background:"var(--color-background-primary)" }}>
                    {filteredAvailableGroups.length === 0 ? (
                      <div style={{ padding:"12px", fontSize:11, color:"var(--color-text-secondary)", textAlign:"center" }}>
                        {groupSearch ? "Guruh topilmadi" : "Mavjud guruh yo'q"}
                      </div>
                    ) : filteredAvailableGroups.map(g => {
                      const sel = addGroupId === String(g.id);
                      return (
                        <div key={g.id}
                          onClick={() => setAddGroupId(sel ? "" : String(g.id))}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", cursor:"pointer", borderBottom:"0.5px solid var(--color-border-tertiary)", background:sel ? "#E1F5EE" : "transparent" }}
                          onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "var(--color-background-secondary)"; }}
                          onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, fontWeight:sel ? 500 : 400, color:sel ? "#085041" : "var(--color-text-primary)" }}>{g.name}</div>
                            {g.teacher && <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{g.teacher.full_name}</div>}
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>
                            {(g.student_groups ?? []).filter(sg => sg.is_active).length}/{g.capacity}
                          </div>
                          {sel && (
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="7" fill="#1D9E75"/>
                              <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={handleAddGroup} disabled={!addGroupId || addingGroup}
                    style={{ width:"100%", padding:"8px", borderRadius:8, border:"none", background:(!addGroupId || addingGroup) ? "#5DCAA5" : "#1D9E75", color:"#fff", fontSize:12, fontWeight:500, cursor:(!addGroupId || addingGroup) ? "default" : "pointer", fontFamily:"var(--font-sans)" }}>
                    {addingGroup ? "Qo'shilmoqda..." : "Guruhga qo'shish"}
                  </button>
                </>
              )}

              {availableGroups.length === 0 && enrolledGroups.length > 0 && (
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:8 }}>
                  Barcha guruhlarga qo'shilgan
                </div>
              )}
            </Section>
          </div>

        </div>
      </div>
    </div>
  );
}