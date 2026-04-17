import { useState } from "react";
import { useLang } from "../../i18n/LangContext";
import { usePermissions } from "../../auth/permissions";
import { useAuth } from "../../auth/AuthContext";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { AVA_PALETTES } from "../../data/mockData";
import {
  Badge, Button, Modal, FormField,
  Input, Select, ModalButtons, ProgressBar, ReadOnlyBanner,
} from "../../components/ui";

// ── helpers ───────────────────────────────────────────────────
const GROUP_COLORS = [
  { bg:"#E1F5EE", tc:"#085041", bar:"#1D9E75" },
  { bg:"#E6F1FB", tc:"#0C447C", bar:"#378ADD" },
  { bg:"#FAEEDA", tc:"#633806", bar:"#BA7517" },
  { bg:"#EEEDFE", tc:"#3C3489", bar:"#7F77DD" },
  { bg:"#EAF3DE", tc:"#27500A", bar:"#639922" },
  { bg:"#FBEAF0", tc:"#72243E", bar:"#D4537E" },
];
function colorFor(id) { return GROUP_COLORS[(id ?? 0) % GROUP_COLORS.length]; }
function initials(n)  { return (n??"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"??"; }
function paletteFor(id){ return AVA_PALETTES[(id??0) % AVA_PALETTES.length]; }

function Skeleton({ h=60, r=10 }) {
  return <div style={{ height:h, borderRadius:r, background:"var(--color-background-secondary)", animation:"pulse 1.4s ease-in-out infinite" }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </div>;
}

const SCHEDULE_DAYS_UZ = ["Du","Se","Cho","Pa","Ju","Sha","Ya"];
const DAYS_OPTIONS = [
  { value:"mon", label:"Dushanba" }, { value:"tue", label:"Seshanba" },
  { value:"wed", label:"Chorshanba" }, { value:"thu", label:"Payshanba" },
  { value:"fri", label:"Juma" }, { value:"sat", label:"Shanba" },
];

// ── Main component ─────────────────────────────────────────────
export default function Groups() {
  const { t, lang }  = useLang();
  const isUz = lang !== "en";
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const perm = P.groups;

  const [view,              setView]              = useState("cards"); // "cards" | "detail"
  const [selected,          setSelected]          = useState(null);
  const [modal,             setModal]             = useState(null);    // null | "create" | "edit" | "addStudent"
  const [form,              setForm]              = useState({});
  const [addStuId,          setAddStuId]          = useState("");
  const [assignTeacherId,   setAssignTeacherId]   = useState("");
  const [availableStudents, setAvailableStudents] = useState([]);
  const [loadingStudents,   setLoadingStudents]   = useState(false);

  // ── Fetch groups ──────────────────────────────────────────
  const { data: groupsRaw, loading: gLoading, refetch: refetchGroups } = useApi(
    () => api.groups.list({ branch_id: isSuperAdmin ? undefined : branchId }),
    [branchId]
  );
  const groups = groupsRaw?.data ?? groupsRaw ?? [];

  // ── Fetch teachers (for form select) ──────────────────────
  const { data: teachersRaw } = useApi(
    () => api.teachers.list({ branch_id: isSuperAdmin ? undefined : branchId }),
    [branchId]
  );
  const teachers = teachersRaw?.data ?? teachersRaw ?? [];

  // ── Fetch subjects ─────────────────────────────────────────
  const { data: subjectsRaw } = useApi(() => api.subjects.list(), []);
  const subjects = subjectsRaw?.data ?? subjectsRaw ?? [];

  // ── Fetch selected group detail ────────────────────────────
  const { data: groupDetail, loading: detailLoading, refetch: refetchDetail } = useApi(
    () => selected ? api.groups.get(selected.id) : Promise.resolve(null),
    [selected?.id]
  );
  const groupStudents = groupDetail?.student_groups ?? [];

  // ── Fetch all students (for add-student dropdown) ─────────
  // (kept for potential other uses; modal now uses availableStudents state)

  // ── Mutations ──────────────────────────────────────────────
  const { mutate: createGroup,   loading: creating }   = useMutation(api.groups.create);
  const { mutate: updateGroup,   loading: updating }   = useMutation((id,d) => api.groups.update(id,d));
  const { mutate: addStudent,    loading: addingStu }  = useMutation((gid,sid) => api.groups.addStudent(gid,sid));
  const { mutate: removeStudent }                      = useMutation((gid,sid) => api.groups.removeStudent(gid,sid));
  const { mutate: assignTeacher, loading: assigning }  = useMutation((gid,tid) => api.groups.assignTeacher(gid,tid));

  // ── Handlers ───────────────────────────────────────────────
  function openCreate() {
    setForm({ name:"", teacher_id:"", subject_id:"", capacity:"15", monthly_fee:"500000", days:[], time:"10:00", level:"" });
    setModal("create");
  }
  function openEdit(g) {
    setForm({
      name: g.name, teacher_id: String(g.teacher_id ?? ""),
      subject_id: String(g.subject_id ?? ""),
      capacity: String(g.capacity), monthly_fee: String(g.monthly_fee),
      days: g.schedule?.days ?? [], time: g.schedule?.time ?? "10:00",
      level: g.level ?? "",
    });
    setModal("edit");
  }

  async function handleCreateGroup() {
    if (!form.name?.trim()) {
      alert(isUz ? "Guruh nomi shart" : "Group name required");
      return;
    }
    try {
      await createGroup({
        branch_id:   branchId ?? groups[0]?.branch_id ?? teachers[0]?.branch_id,
        teacher_id:  form.teacher_id ? Number(form.teacher_id) : null,
        subject_id:  form.subject_id ? Number(form.subject_id) : null,
        name:        form.name.trim(),
        capacity:    Number(form.capacity)    || 15,
        monthly_fee: Number(form.monthly_fee) || 500000,
        level:       form.level || null,
        schedule:    form.days.length > 0 ? { days: form.days, time: form.time } : null,
      });
      setModal(null);
      refetchGroups();
    } catch(e) { alert(e.message ?? "Xatolik yuz berdi"); }
  }

  async function handleUpdateGroup() {
    if (!selected || !form.name) return;
    try {
      const updated = await updateGroup(selected.id, {
        name:        form.name,
        ...(form.teacher_id ? { teacher_id: Number(form.teacher_id) } : {}),
        ...(form.subject_id ? { subject_id: Number(form.subject_id) } : {}),
        capacity:    Number(form.capacity),
        monthly_fee: Number(form.monthly_fee),
        level:       form.level || null,
        schedule:    form.days.length > 0 ? { days: form.days, time: form.time } : null,
      });
      if (updated) setSelected(prev => ({ ...prev, ...updated }));
      setModal(null);
      refetchGroups();
      refetchDetail();
    } catch(e) { alert(e.message); }
  }

  async function handleAddStudent() {
    if (!addStuId || !selected) return;
    try {
      await addStudent(selected.id, Number(addStuId));
      setModal(null);
      setAddStuId("");
      refetchDetail();
      refetchGroups();
    } catch(e) { alert(e.message); }
  }

  async function handleAssignTeacher() {
    if (!assignTeacherId || !selected) return;
    try {
      await assignTeacher(selected.id, Number(assignTeacherId));
      setAssignTeacherId("");
      refetchGroups();
      refetchDetail();
    } catch(e) { alert(e.message); }
  }

  async function handleRemoveStudent(studentId) {
    if (!selected) return;
    await removeStudent(selected.id, studentId);
    refetchDetail();
  }

  function toggleDay(day) {
    setForm(p => ({
      ...p,
      days: p.days.includes(day) ? p.days.filter(d=>d!==day) : [...p.days, day],
    }));
  }

  async function loadAvailableStudents() {
    try {
      const groupsRes = await api.groups.list(
        isSuperAdmin ? {} : { branch_id: branchId }
      );
      const allGroups = Array.isArray(groupsRes) ? groupsRes : groupsRes?.data ?? [];

      const enrolledAnywhere = new Set();
      allGroups.forEach(g => {
        (g.student_groups ?? []).forEach(sg => {
          if (sg.is_active) enrolledAnywhere.add(sg.student_id);
        });
      });

      // Also include current group detail (more accurate than list payload)
      (groupDetail?.student_groups ?? []).forEach(sg => {
        if (sg.is_active) enrolledAnywhere.add(sg.student_id);
      });

      const studRes = await api.students.list(
        isSuperAdmin ? { limit: 500 } : { branch_id: branchId, limit: 500 }
      );
      const allStuds = studRes?.data ?? [];
      return allStuds.filter(s => !enrolledAnywhere.has(s.id));
    } catch (e) {
      console.error("Failed to load available students:", e);
      return [];
    }
  }

  async function openAddStudentModal() {
    setModal("addStudent");
    setLoadingStudents(true);
    const available = await loadAvailableStudents();
    setAvailableStudents(available);
    setLoadingStudents(false);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>

      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        {selected && view === "detail" ? (
          <>
            <button onClick={()=>{ setView("cards"); setSelected(null); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--color-text-secondary)", fontSize:13, display:"flex", alignItems:"center", gap:4, fontFamily:"var(--font-sans)", padding:"4px 0" }}>
              ← {isUz?"Guruhlar":"Groups"}
            </button>
            <span style={{ color:"var(--color-text-secondary)" }}>/</span>
            <span style={{ fontSize:14, fontWeight:500 }}>{selected.name}</span>
            <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
              <Button variant="secondary" onClick={()=>openEdit(selected)}>{isUz?"Tahrirlash":"Edit"}</Button>
              {perm.canAddStudent && <Button onClick={()=>openAddStudentModal()}>{isUz?"+ Talaba qo'shish":"+ Add student"}</Button>}
            </div>
          </>
        ) : (
          <>
            <span style={{ fontSize:14, fontWeight:500 }}>{isUz?"Guruhlar":"Groups"}</span>
            <span style={{ fontSize:12, color:"var(--color-text-secondary)", marginLeft:4 }}>{groups.length}{isUz?" ta guruh":" groups"}</span>
            {perm.canCreate && <Button onClick={openCreate} style={{ marginLeft:"auto" }}>{isUz?"+ Guruh yaratish":"+ Create group"}</Button>}
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>

        {view === "cards" ? (
          // ── CARDS VIEW ──────────────────────────────────────
          <>
            {gLoading ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:10 }}>
                {Array(6).fill(0).map((_,i) => <Skeleton key={i} h={180}/>)}
              </div>
            ) : groups.length === 0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12, color:"var(--color-text-secondary)", fontSize:13 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="5" y="12" width="30" height="22" rx="4" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                  <path d="M14 12V10a6 6 0 0112 0v2" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                </svg>
                {isUz?"Hali guruh yo'q. Birinchi guruhni yarating!":"No groups yet. Create the first one!"}
                <Button onClick={openCreate}>{isUz?"+ Guruh yaratish":"+ Create group"}</Button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))", gap:10 }}>
                {groups.map(g => {
                  const col   = colorFor(g.id);
                  const count = g.student_count ?? 0;
                  const pct   = g.capacity ? Math.round(count / g.capacity * 100) : 0;
                  const isFull = pct >= 100;
                  const sch   = g.schedule;
                  const days  = (sch?.days ?? []).map(d => ({ mon:"Du",tue:"Se",wed:"Cho",thu:"Pa",fri:"Ju",sat:"Sha" }[d] ?? d)).join(", ");

                  return (
                    <div key={g.id}
                      onClick={() => { setSelected(g); setView("detail"); }}
                      style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:12, padding:14, cursor:"pointer", transition:"border-color .15s, box-shadow .15s", display:"flex", flexDirection:"column", gap:10 }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=col.bar; e.currentTarget.style.boxShadow=`0 2px 12px ${col.bar}22`; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--color-border-tertiary)"; e.currentTarget.style.boxShadow="none"; }}>

                      {/* Icon + name */}
                      <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:col.bg, color:col.tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, flexShrink:0 }}>
                          {g.name.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.name}</div>
                          {isFull && <Badge preset="red" style={{ fontSize:9, padding:"1px 6px", marginTop:2 }}>To'ldi</Badge>}
                        </div>
                      </div>

                      {/* Meta */}
                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                        {days && (
                          <div style={{ fontSize:11, color:"var(--color-text-secondary)", display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ fontSize:10 }}>📅</span> {days} {sch?.time && `| ${sch.time}`}
                          </div>
                        )}
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)", display:"flex", alignItems:"center", gap:5 }}>
                          <span style={{ fontSize:10 }}>💰</span> {Number(g.monthly_fee).toLocaleString()} so'm/oy
                        </div>
                      </div>

                      {/* Progress */}
                      <div>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--color-text-secondary)", marginBottom:5 }}>
                          <span>Talabalar</span>
                          <span style={{ fontWeight:500, color: isFull?"#A32D2D":"var(--color-text-primary)" }}>{count}/{g.capacity}</span>
                        </div>
                        <ProgressBar percent={pct} color={isFull?"#E24B4A":col.bar}/>
                      </div>

                      {/* Footer */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:2 }}>
                        <Badge preset={g.is_active?"green":"gray"}>{g.is_active?"Aktiv":"Nofaol"}</Badge>
                        <button onClick={e=>{ e.stopPropagation(); openEdit(g); setSelected(g); }}
                          style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"var(--color-text-secondary)", padding:"2px 6px", borderRadius:5, fontFamily:"var(--font-sans)" }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}>
                          ✎ Tahrirlash
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          // ── DETAIL VIEW ──────────────────────────────────────
          detailLoading ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120, color:"var(--color-text-secondary)", fontSize:12 }}>Yuklanmoqda...</div>
          ) : (
            <div className="group-detail-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,280px)", gap:14, alignItems:"start" }}>

              {/* Students table */}
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)", marginBottom:10 }}>
                  {isUz?"Talabalar":"Students"} ({groupStudents.filter(sg=>sg.is_active).length}/{selected?.capacity})
                </div>
                <div style={{ background:"var(--color-background-primary)", borderRadius:10, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden" }}>
                  {groupStudents.filter(sg=>sg.is_active).length === 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:100, gap:8, color:"var(--color-text-secondary)", fontSize:12 }}>
                      Guruhda hali talaba yo'q
                      {perm.canAddStudent && <Button onClick={()=>openAddStudentModal()}>+ Talaba qo'shish</Button>}
                    </div>
                  ) : (
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr>
                          {["Ism", "Telefon", "Qo'shilgan", ""].map(h => (
                            <th key={h} style={{ textAlign:"left", padding:"7px 12px", fontSize:10, color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.filter(sg=>sg.is_active).map((sg, i) => {
                          const stu = sg.student ?? {};
                          const pal = paletteFor(sg.student_id);
                          return (
                            <tr key={sg.id} style={{ borderBottom: i < groupStudents.length-1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}
                              onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                              onMouseLeave={e=>e.currentTarget.style.background=""}>
                              <td style={{ padding:"8px 12px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <div style={{ width:28, height:28, borderRadius:"50%", background:pal.bg, color:pal.tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:500, flexShrink:0 }}>
                                    {initials(stu.full_name)}
                                  </div>
                                  <span style={{ fontSize:12, fontWeight:500 }}>{stu.full_name ?? `Talaba #${sg.student_id}`}</span>
                                </div>
                              </td>
                              <td style={{ padding:"8px 12px", fontSize:11, color:"var(--color-text-secondary)" }}>{stu.phone ?? "—"}</td>
                              <td style={{ padding:"8px 12px", fontSize:11, color:"var(--color-text-secondary)" }}>{sg.joined_at?.slice(0,10) ?? "—"}</td>
                              <td style={{ padding:"8px 12px" }}>
                                <button onClick={()=>handleRemoveStudent(sg.student_id)}
                                  style={{ background:"none", border:"0.5px solid var(--color-border-tertiary)", borderRadius:6, padding:"3px 9px", fontSize:10, cursor:"pointer", color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}
                                  onMouseEnter={e=>{ e.currentTarget.style.background="#FCEBEB"; e.currentTarget.style.color="#791F1F"; e.currentTarget.style.borderColor="#F09595"; }}
                                  onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="var(--color-text-secondary)"; e.currentTarget.style.borderColor="var(--color-border-tertiary)"; }}>
                                  Chiqarish
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Group info card */}
              <div style={{ background:"var(--color-background-primary)", borderRadius:10, border:"0.5px solid var(--color-border-tertiary)", padding:14, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>Guruh ma'lumotlari</div>
                {[
                  { label:"O'qituvchi",   val: groupDetail?.teacher?.full_name ?? selected?.teacher?.full_name ?? "—" },
                  { label:"Sig'im",       val:`${groupStudents.filter(sg=>sg.is_active).length} / ${selected?.capacity}` },
                  { label:"Oylik to'lov", val:`${Number(selected?.monthly_fee??0).toLocaleString()} so'm` },
                  { label:"Holat",        val: selected?.is_active ? "✅ Aktiv" : "❌ Nofaol" },
                ].map(item => (
                  <div key={item.label} style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <span style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".04em" }}>{item.label}</span>
                    <span style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>{item.val}</span>
                  </div>
                ))}
                {selected?.schedule && (
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <span style={{ fontSize:10, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".04em" }}>Jadval</span>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {(selected.schedule.days ?? []).map(d => (
                        <span key={d} style={{ background:"#E1F5EE", color:"#085041", padding:"2px 7px", borderRadius:10, fontSize:10 }}>
                          {{ mon:"Du",tue:"Se",wed:"Cho",thu:"Pa",fri:"Ju",sat:"Sha" }[d] ?? d}
                        </span>
                      ))}
                      {selected.schedule.time && <span style={{ background:"#E6F1FB", color:"#0C447C", padding:"2px 7px", borderRadius:10, fontSize:10 }}>{selected.schedule.time}</span>}
                    </div>
                  </div>
                )}
                <div style={{ paddingTop:8, borderTop:"0.5px solid var(--color-border-tertiary)", display:"flex", flexDirection:"column", gap:6 }}>
                  {perm.canEdit && (
                    <div style={{ display:"flex", gap:6 }}>
                      <select
                        value={assignTeacherId}
                        onChange={e=>setAssignTeacherId(e.target.value)}
                        style={{ flex:1, border:"0.5px solid var(--color-border-secondary)", borderRadius:7, padding:"5px 8px", fontSize:11, fontFamily:"var(--font-sans)", background:"var(--color-background-primary)", color:"var(--color-text-primary)", outline:"none" }}>
                        <option value="">O'qituvchi tanlang...</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                      <Button onClick={handleAssignTeacher} style={{ flexShrink:0, opacity:assigning?.6:1 }}>
                        {assigning ? "..." : isUz?"Belgilash":"Assign"}
                      </Button>
                    </div>
                  )}
                  <Button variant="secondary" onClick={()=>openEdit(selected)} style={{ width:"100%", justifyContent:"center" }}>
                    ✎ Guruhni tahrirlash
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── CREATE / EDIT MODAL ─────────────────────────────────── */}
      <Modal open={modal === "create" || modal === "edit"} onClose={()=>setModal(null)}>
        <div style={{ fontSize:14, fontWeight:500 }}>
          {modal === "create" ? (isUz?"Yangi guruh yaratish":"Create new group") : (isUz?"Guruhni tahrirlash":"Edit group")}
        </div>
        <FormField label="GURUH NOMI">
          <Input value={form.name??""} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="English B1"/>
        </FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <FormField label="O'QITUVCHI">
            <Select value={form.teacher_id??""} onChange={v=>setForm(p=>({...p,teacher_id:v}))}>
              <option value="">Tanlang</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </FormField>
          <FormField label="FAN">
            <Select value={form.subject_id??""} onChange={v=>setForm(p=>({...p,subject_id:v}))}>
              <option value="">Tanlang</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <FormField label="SIG'IM">
            <Input value={form.capacity??""} onChange={v=>setForm(p=>({...p,capacity:v}))} placeholder="15"/>
          </FormField>
          <FormField label="OYLIK TO'LOV">
            <Input value={form.monthly_fee??""} onChange={v=>setForm(p=>({...p,monthly_fee:v}))} placeholder="500000"/>
          </FormField>
        </div>
        <FormField label={isUz ? "DARAJA" : "LEVEL"}>
          <Select value={form.level??""} onChange={v=>setForm(p=>({...p,level:v}))}>
            <option value="">{isUz ? "Tanlang (ixtiyoriy)" : "Select (optional)"}</option>
            <option value="beginner">{isUz ? "Boshlang'ich" : "Beginner"}</option>
            <option value="intermediate">{isUz ? "O'rta" : "Intermediate"}</option>
            <option value="advanced">{isUz ? "Yuqori" : "Advanced"}</option>
          </Select>
        </FormField>
        <FormField label="DARS KUNLARI">
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingTop:4 }}>
            {DAYS_OPTIONS.map(d => {
              const sel = (form.days??[]).includes(d.value);
              return (
                <button key={d.value} type="button" onClick={()=>toggleDay(d.value)}
                  style={{ padding:"4px 10px", borderRadius:20, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border: sel?"0.5px solid #1D9E75":"0.5px solid var(--color-border-tertiary)", background: sel?"#E1F5EE":"var(--color-background-primary)", color: sel?"#085041":"var(--color-text-secondary)", transition:"all .12s" }}>
                  {d.label.slice(0,3)}
                </button>
              );
            })}
          </div>
        </FormField>
        <FormField label="DARS VAQTI">
          <Input value={form.time??""} onChange={v=>setForm(p=>({...p,time:v}))} placeholder="10:00"/>
        </FormField>
        <ModalButtons>
          <Button variant="ghost" onClick={()=>setModal(null)}>{isUz?"Bekor qilish":"Cancel"}</Button>
          <Button
            onClick={modal==="create" ? handleCreateGroup : handleUpdateGroup}
            style={{ opacity:(creating||updating)?.6:1 }}>
            {(creating||updating) ? (isUz?"Saqlanmoqda...":"Saving...") : (isUz?"Saqlash":"Save")}
          </Button>
        </ModalButtons>
      </Modal>

      {/* ── ADD STUDENT MODAL ───────────────────────────────────── */}
      <Modal open={modal === "addStudent"} onClose={()=>setModal(null)}>
        <div style={{ fontSize:14, fontWeight:500 }}>Guruhga talaba qo'shish</div>
        <div style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{selected?.name}</div>
        <FormField label="TALABANI TANLANG">
          <Select value={addStuId} onChange={setAddStuId}>
            <option value="">
              {loadingStudents ? "Yuklanmoqda..." : "Tanlang..."}
            </option>
            {!loadingStudents && availableStudents.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} — {s.phone}</option>
            ))}
          </Select>
        </FormField>
        {!loadingStudents && availableStudents.length === 0 && (
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", background:"var(--color-background-secondary)", borderRadius:8, padding:"8px 12px" }}>
            Barcha talabalar allaqachon guruhlarda
          </div>
        )}
        <ModalButtons>
          <Button variant="ghost" onClick={()=>setModal(null)}>Bekor qilish</Button>
          <Button onClick={handleAddStudent} style={{ opacity:addingStu?.6:1 }}>
            {addingStu ? "..." : "Qo'shish"}
          </Button>
        </ModalButtons>
      </Modal>
    </div>
  );
}
