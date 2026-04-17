import { useState } from "react";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { Button, Modal, FormField, Input, Select, ModalButtons, ProgressBar } from "../../components/ui";

const ATT_CONFIG = {
  present: { bg:"#E1F5EE", tc:"#085041", uz:"K",  en:"P", next:"absent"  },
  absent:  { bg:"#FCEBEB", tc:"#791F1F", uz:"Nm", en:"A", next:"excused" },
  excused: { bg:"#FAEEDA", tc:"#633806", uz:"S",  en:"E", next:"present" },
};

function Dot({ status, onClick, isUz }) {
  const cfg = ATT_CONFIG[status] ?? ATT_CONFIG.present;
  return (
    <span onClick={onClick}
      style={{ width:28, height:28, borderRadius:"50%", background:cfg.bg, color:cfg.tc,
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        fontSize:10, fontWeight:500, cursor:"pointer", userSelect:"none",
        transition:"transform .1s", flexShrink:0 }}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      {isUz ? cfg.uz : cfg.en}
    </span>
  );
}

function Sk({ h=40, r=8 }) {
  return <div style={{ height:h, borderRadius:r, background:"var(--color-background-secondary)", animation:"pulse 1.4s ease-in-out infinite" }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </div>;
}

function Card({ children, style }) {
  return <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:14, ...style }}>{children}</div>;
}

// Rol bo'yicha nima qila oladi
function useRoleAccess() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  return {
    canCreate:    ["super_admin","admin","manager"].includes(role),
    canDelete:    ["super_admin","admin","manager"].includes(role),
    canMarkAtt:   ["super_admin","admin","manager","teacher"].includes(role),
    isTeacher:    role === "teacher",
    isCashier:    role === "cashier",
    isAdminLevel: ["super_admin","admin","manager"].includes(role),
  };
}

export default function Lessons() {
  const { lang } = useLang();
  const { branchId, isSuperAdmin, user } = useAuth();
  const access = useRoleAccess();
  const isUz = lang !== "en";

  const T = {
    title:       isUz ? "Darslar" : "Lessons",
    addLesson:   isUz ? "+ Dars qo'shish" : "+ Add Lesson",
    allGroups:   isUz ? "Barcha guruhlar" : "All Groups",
    noLessons:   isUz ? "Hali dars yo'q" : "No lessons yet",
    markAtt:     isUz ? "Davomat belgilash" : "Mark Attendance",
    viewAtt:     isUz ? "Davomatni ko'rish" : "View Attendance",
    saveAtt:     isUz ? "Saqlash" : "Save",
    cancel:      isUz ? "Bekor qilish" : "Cancel",
    today:       isUz ? "Bugun" : "Today",
    noAccess:    isUz ? "Ruxsat yo'q" : "No access",
    present:     isUz ? "Keldi" : "Present",
    absent:      isUz ? "Kelmadi" : "Absent",
    excused:     isUz ? "Sababli" : "Excused",
    hint:        isUz ? "Bosib holat o'zgartiring" : "Click to toggle",
    saved:       isUz ? "✅ Saqlandi!" : "✅ Saved!",
    noStudents:  isUz ? "Guruhda talaba yo'q" : "No students",
    fGroup:      isUz ? "GURUH" : "GROUP",
    fDate:       isUz ? "SANA" : "DATE",
    fStart:      isUz ? "BOSHLANISH" : "START TIME",
    fEnd:        isUz ? "TUGASH" : "END TIME",
    fTopic:      isUz ? "MAVZU (ixtiyoriy)" : "TOPIC (optional)",
    addTitle:    isUz ? "Yangi dars qo'shish" : "Add New Lesson",
    attTitle:    isUz ? "Davomat belgilash" : "Mark Attendance",
    loading:     isUz ? "Yuklanmoqda..." : "Loading...",
    cancelled:   isUz ? "Bekor qilindi" : "Cancelled",
    roleInfo:    isUz ? "Siz faqat o'z guruhlaringizni ko'rasiz" : "You see only your groups",
    cashierInfo: isUz ? "To'lovlar bo'limidan foydalaning" : "Use the Payments section",
  };

  const [selGroup,  setSelGroup]  = useState(null);
  const [selLesson, setSelLesson] = useState(null);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState({});
  const [attState,  setAttState]  = useState({});
  const [saveMsg,   setSaveMsg]   = useState("");
  const [dateFilter,setDateFilter]= useState("");

  const [filterYear, filterMonth] = dateFilter
    ? [parseInt(dateFilter.split("-")[0]), parseInt(dateFilter.split("-")[1])]
    : [new Date().getFullYear(), new Date().getMonth() + 1];

  const dateFrom = `${filterYear}-${String(filterMonth).padStart(2,"0")}-01`;
  const dateTo   = `${filterYear}-${String(filterMonth).padStart(2,"0")}-31`;

  const { data: groupsRaw } = useApi(
    () => api.groups.list({ branch_id: isSuperAdmin ? undefined : branchId }),
    [branchId]
  );
  const groups = groupsRaw ?? [];

  const { data: teachersRaw } = useApi(
    () => api.teachers.list({ branch_id: isSuperAdmin ? undefined : branchId }),
    [branchId]
  );
  const teachers = teachersRaw ?? [];

  const { data: lessonsRaw, loading, refetch } = useApi(
    () => api.lessons.list({
      group_id: selGroup?.id,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    [selGroup?.id, dateFrom, dateTo]
  );
  const lessons = (lessonsRaw ?? []).sort((a,b) => b.lesson_date.localeCompare(a.lesson_date));

  const { data: groupDetail } = useApi(
    () => selLesson ? api.groups.get(selLesson.group_id) : Promise.resolve(null),
    [selLesson?.id]
  );
  const groupStudents = (groupDetail?.student_groups ?? []).filter(sg => sg.is_active);

  const { mutate: createLesson,   loading: creating }  = useMutation(api.lessons.create);
  const { mutate: deleteLesson              }           = useMutation(id => api.lessons.delete(id));
  const { mutate: markAttendance, loading: saving }     = useMutation(
    (id, entries) => api.lessons.markAttendance(id, entries)
  );

  function openCreate() {
    if (!access.canCreate) return;
    const today = new Date().toISOString().slice(0,10);
    setForm({ group_id: groups[0]?.id ?? "", lesson_date: today, start_time: "10:00", end_time: "12:00", topic: "" });
    setModal("create");
  }

  async function handleCreate() {
    if (!form.group_id || !form.lesson_date || !form.start_time) return;
    const group = groups.find(g => g.id === Number(form.group_id));
    try {
      await createLesson({
        group_id:    Number(form.group_id),
        teacher_id:  group?.teacher_id ?? teachers[0]?.id,
        lesson_date: form.lesson_date,
        start_time:  form.start_time + ":00",
        end_time:    form.end_time   + ":00",
        topic:       form.topic || null,
      });
      setModal(null);
      refetch();
    } catch(e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!access.canDelete) return;
    if (!confirm(isUz ? "Darsni o'chirishni xohlaysizmi?" : "Delete this lesson?")) return;
    try { await deleteLesson(id); refetch(); }
    catch(e) { alert(e.message); }
  }

  function openAttendance(lesson) {
    if (!access.canMarkAtt) return;
    setSelLesson(lesson);
    const initial = {};
    (lesson.attendances ?? []).forEach(a => { initial[a.student_id] = a.status; });
    setAttState(initial);
    setSaveMsg("");
    setModal("attendance");
  }

  function toggleAtt(sid) {
    setAttState(prev => {
      const cur = prev[sid] ?? "present";
      return { ...prev, [sid]: ATT_CONFIG[cur]?.next ?? "present" };
    });
  }

  async function handleSaveAtt() {
    if (!selLesson || !access.canMarkAtt) return;
    const entries = groupStudents.map(sg => ({
      student_id: sg.student_id,
      status:     attState[sg.student_id] ?? "present",
    }));
    try {
      await markAttendance(selLesson.id, entries);
      setSaveMsg(T.saved);
      refetch();
      setTimeout(() => setSaveMsg(""), 2500);
    } catch(e) { alert(e.message); }
  }

  function attStats(lesson) {
    const atts = lesson.attendances ?? [];
    const total = atts.length;
    const present = atts.filter(a=>a.status==="present").length;
    const absent  = atts.filter(a=>a.status==="absent").length;
    const excused = atts.filter(a=>a.status==="excused").length;
    const pct = total > 0 ? Math.round(present/total*100) : null;
    return { total, present, absent, excused, pct };
  }

  // Kassir uchun alohida xabar
  if (access.isCashier) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", background:"var(--color-background-tertiary)" }}>
        <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
          <span style={{ fontSize:14, fontWeight:500 }}>{T.title}</span>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--color-text-secondary)", fontSize:13 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
            <path d="M20 12v10M20 28v1" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>{T.noAccess}</div>
          <div style={{ fontSize:12 }}>{T.cashierInfo}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>
      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{T.title}</span>

        {/* O'qituvchiga ma'lumot */}
        {access.isTeacher && (
          <span style={{ fontSize:11, color:"#0C447C", background:"#E6F1FB", padding:"3px 9px", borderRadius:10 }}>
            {T.roleInfo}
          </span>
        )}

        {/* Guruh filtri — admin/manager uchun barchasi, o'qituvchi uchun faqat o'ziniki (API o'zi filtrlab beradi) */}
        <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginLeft:8 }}>
          <button onClick={()=>setSelGroup(null)}
            style={{ padding:"4px 11px", borderRadius:20, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border:!selGroup?"0.5px solid #1D9E75":"0.5px solid var(--color-border-tertiary)", background:!selGroup?"#E1F5EE":"var(--color-background-primary)", color:!selGroup?"#0F6E56":"var(--color-text-secondary)" }}>
            {T.allGroups}
          </button>
          {groups.map(g => (
            <button key={g.id} onClick={()=>setSelGroup(g)}
              style={{ padding:"4px 11px", borderRadius:20, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border:selGroup?.id===g.id?"0.5px solid #1D9E75":"0.5px solid var(--color-border-tertiary)", background:selGroup?.id===g.id?"#E1F5EE":"var(--color-background-primary)", color:selGroup?.id===g.id?"#0F6E56":"var(--color-text-secondary)" }}>
              {g.name}
            </button>
          ))}
        </div>

        <input type="month"
          value={dateFilter || `${filterYear}-${String(filterMonth).padStart(2,"0")}`}
          onChange={e=>setDateFilter(e.target.value)}
          style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"5px 10px", fontSize:12, background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", outline:"none", marginLeft:"auto" }}/>

        {/* Faqat admin/manager dars qo'sha oladi */}
        {access.canCreate && (
          <Button onClick={openCreate}>{T.addLesson}</Button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>

        {/* Summary */}
        {!loading && lessons.length > 0 && (
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            {[
              { label:`${lessons.length} dars`, color:"var(--color-text-primary)" },
              { label:`${lessons.reduce((a,l)=>(l.attendances??[]).filter(x=>x.status==="present").length+a,0)} ${T.present}`, color:"#1D9E75" },
              { label:`${lessons.reduce((a,l)=>(l.attendances??[]).filter(x=>x.status==="absent").length+a,0)} ${T.absent}`, color:"#A32D2D" },
            ].map((item,i) => (
              <div key={i} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8, padding:"7px 13px", fontSize:12, fontWeight:500, color:item.color }}>
                {item.label}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {Array(4).fill(0).map((_,i)=><Sk key={i} h={80}/>)}
          </div>
        ) : lessons.length === 0 ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, gap:12, color:"var(--color-text-secondary)", fontSize:13 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <rect x="6" y="12" width="32" height="26" rx="5" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
              <path d="M14 12V9a8 8 0 0116 0v3" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
              <path d="M15 22h14M15 28h8" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {T.noLessons}
            {access.canCreate && <Button onClick={openCreate}>{T.addLesson}</Button>}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {lessons.map(lesson => {
              const stats   = attStats(lesson);
              const group   = groups.find(g=>g.id===lesson.group_id);
              const teacher = teachers.find(t=>t.id===lesson.teacher_id);
              const isToday = lesson.lesson_date === new Date().toISOString().slice(0,10);
              const hasAtt  = (lesson.attendances ?? []).length > 0;

              return (
                <Card key={lesson.id} style={{ display:"flex", gap:12, opacity:lesson.is_cancelled?.6:1 }}>
                  {/* Date block */}
                  <div style={{ width:50, height:50, borderRadius:9, background:isToday?"#E1F5EE":"var(--color-background-secondary)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0, border:isToday?"0.5px solid #5DCAA5":"none" }}>
                    <div style={{ fontSize:18, fontWeight:600, lineHeight:1, color:isToday?"#085041":"var(--color-text-primary)" }}>{lesson.lesson_date?.slice(8)}</div>
                    <div style={{ fontSize:10, color:isToday?"#1D9E75":"var(--color-text-secondary)", marginTop:1 }}>
                      {isToday ? T.today : new Date(lesson.lesson_date+"T00:00").toLocaleDateString(isUz?"uz-UZ":"en-US",{month:"short"})}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>
                        {lesson.topic || group?.name || `Dars #${lesson.id}`}
                      </span>
                      {lesson.is_cancelled && <span style={{ background:"#FCEBEB", color:"#791F1F", padding:"2px 7px", borderRadius:10, fontSize:10 }}>{T.cancelled}</span>}
                      {isToday && <span style={{ background:"#E1F5EE", color:"#085041", padding:"2px 7px", borderRadius:10, fontSize:10 }}>{T.today}</span>}
                    </div>
                    <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                      {group && <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>👥 {group.name}</span>}
                      {teacher && <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>👩‍🏫 {teacher.full_name}</span>}
                      <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>🕐 {lesson.start_time?.slice(0,5)} – {lesson.end_time?.slice(0,5)}</span>
                    </div>
                  </div>

                  {/* Right: attendance + actions */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                    {hasAtt && (
                      <>
                        <div style={{ display:"flex", gap:4 }}>
                          {[{v:stats.present,bg:"#E1F5EE",tc:"#085041"},{v:stats.absent,bg:"#FCEBEB",tc:"#791F1F"},{v:stats.excused,bg:"#FAEEDA",tc:"#633806"}].map((item,i)=>(
                            <span key={i} style={{ background:item.bg, color:item.tc, padding:"3px 8px", borderRadius:10, fontSize:10, fontWeight:500 }}>{item.v}</span>
                          ))}
                        </div>
                        {stats.pct !== null && (
                          <div style={{ display:"flex", alignItems:"center", gap:5, width:110 }}>
                            <ProgressBar percent={stats.pct} color={stats.pct<60?"#E24B4A":stats.pct<80?"#BA7517":"#1D9E75"} height={4}/>
                            <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{stats.pct}%</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Davomat tugmasi — faqat ruxsati bor rollar uchun */}
                    {access.canMarkAtt && !lesson.is_cancelled && (
                      <button onClick={()=>openAttendance(lesson)}
                        style={{ padding:"3px 10px", borderRadius:6, fontSize:10, cursor:"pointer", fontFamily:"var(--font-sans)",
                          border: hasAtt ? "0.5px solid #5DCAA5" : "none",
                          background: hasAtt ? "#E1F5EE" : "#1D9E75",
                          color: hasAtt ? "#085041" : "#fff",
                        }}>
                        {hasAtt ? `✎ ${T.markAtt}` : T.markAtt}
                      </button>
                    )}

                    {/* O'chirish — faqat admin/manager */}
                    {access.canDelete && (
                      <button onClick={()=>handleDelete(lesson.id)}
                        style={{ padding:"3px 8px", borderRadius:6, fontSize:10, cursor:"pointer", background:"none", border:"0.5px solid var(--color-border-tertiary)", color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}
                        onMouseEnter={e=>{e.currentTarget.style.background="#FCEBEB";e.currentTarget.style.color="#791F1F";e.currentTarget.style.borderColor="#F09595";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--color-text-secondary)";e.currentTarget.style.borderColor="var(--color-border-tertiary)";}}>
                        ✕
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE MODAL — faqat admin/manager */}
      {access.canCreate && (
        <Modal open={modal==="create"} onClose={()=>setModal(null)}>
          <div style={{ fontSize:14, fontWeight:500 }}>{T.addTitle}</div>
          <FormField label={T.fGroup}>
            <Select value={form.group_id??""} onChange={v=>setForm(p=>({...p,group_id:v}))}>
              <option value="">{isUz?"Guruhni tanlang":"Select group"}</option>
              {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </FormField>
          <FormField label={T.fDate}>
            <input type="date" value={form.lesson_date??""} onChange={e=>setForm(p=>({...p,lesson_date:e.target.value}))}
              style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
          </FormField>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <FormField label={T.fStart}>
              <input type="time" value={form.start_time??""} onChange={e=>setForm(p=>({...p,start_time:e.target.value}))}
                style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
            </FormField>
            <FormField label={T.fEnd}>
              <input type="time" value={form.end_time??""} onChange={e=>setForm(p=>({...p,end_time:e.target.value}))}
                style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
            </FormField>
          </div>
          <FormField label={T.fTopic}>
            <Input value={form.topic??""} onChange={v=>setForm(p=>({...p,topic:v}))} placeholder="Present Perfect"/>
          </FormField>
          <ModalButtons>
            <Button variant="ghost" onClick={()=>setModal(null)}>{T.cancel}</Button>
            <Button onClick={handleCreate} style={{ opacity:creating?.6:1 }}>
              {creating?(isUz?"Saqlanmoqda...":"Saving..."):T.saveAtt}
            </Button>
          </ModalButtons>
        </Modal>
      )}

      {/* ATTENDANCE MODAL — admin/manager/teacher */}
      {access.canMarkAtt && (
        <Modal open={modal==="attendance"} onClose={()=>setModal(null)} side>
          {selLesson && (
            <>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{T.attTitle}</div>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>
                    {groups.find(g=>g.id===selLesson.group_id)?.name} · {selLesson.lesson_date} · {selLesson.start_time?.slice(0,5)}
                  </div>
                </div>
                <button onClick={()=>setModal(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:"var(--color-text-secondary)", lineHeight:1 }}>×</button>
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:8 }}>
                {Object.entries(ATT_CONFIG).map(([key,cfg])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--color-text-secondary)" }}>
                    <span style={{ width:20, height:20, borderRadius:"50%", background:cfg.bg, color:cfg.tc, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:500 }}>
                      {isUz?cfg.uz:cfg.en}
                    </span>
                    {key==="present"?T.present:key==="absent"?T.absent:T.excused}
                  </div>
                ))}
                <span style={{ fontSize:10, color:"var(--color-text-secondary)", marginLeft:"auto" }}>{T.hint}</span>
              </div>

              {/* Students */}
              {groupStudents.length === 0 ? (
                <div style={{ padding:20, textAlign:"center", color:"var(--color-text-secondary)", fontSize:12 }}>{T.noStudents}</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {groupStudents.map((sg,i) => {
                    const stu    = sg.student ?? {};
                    const status = attState[sg.student_id] ?? "present";
                    const cfg    = ATT_CONFIG[status];
                    const ini    = (stu.full_name??"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
                    return (
                      <div key={sg.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, background:i%2===0?"transparent":"var(--color-background-secondary)" }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:cfg.bg, color:cfg.tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:500, flexShrink:0, transition:"background .15s" }}>{ini}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {stu.full_name ?? `Talaba #${sg.student_id}`}
                          </div>
                          {stu.phone && <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{stu.phone}</div>}
                        </div>
                        <Dot status={status} onClick={()=>toggleAtt(sg.student_id)} isUz={isUz}/>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Live stats */}
              {groupStudents.length > 0 && (
                <div style={{ display:"flex", gap:8, padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:8 }}>
                  {[
                    { label:T.present, count:groupStudents.filter(sg=>(attState[sg.student_id]??"present")==="present").length, color:"#1D9E75" },
                    { label:T.absent,  count:Object.values(attState).filter(v=>v==="absent").length,  color:"#A32D2D" },
                    { label:T.excused, count:Object.values(attState).filter(v=>v==="excused").length, color:"#BA7517" },
                  ].map(item=>(
                    <div key={item.label} style={{ flex:1, textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:500, color:item.color }}>{item.count}</div>
                      <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Save */}
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Button onClick={handleSaveAtt} style={{ flex:1, justifyContent:"center", opacity:saving?.6:1 }}>
                  {saving?(isUz?"Saqlanmoqda...":"Saving..."):T.saveAtt}
                </Button>
                {saveMsg && <span style={{ fontSize:12, color:"#1D9E75", fontWeight:500 }}>{saveMsg}</span>}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
