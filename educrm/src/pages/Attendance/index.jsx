import { useState } from "react";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { NoAccess, ProgressBar, Button } from "../../components/ui";

// ── Constants ──────────────────────────────────────────────────
const ATT = {
  present: { bg:"#E1F5EE", tc:"#085041", uz:"Keldi",   en:"Present", dot_uz:"K",  dot_en:"P", next:"absent"  },
  absent:  { bg:"#FCEBEB", tc:"#791F1F", uz:"Kelmadi", en:"Absent",  dot_uz:"Nm", dot_en:"A", next:"excused" },
  excused: { bg:"#FAEEDA", tc:"#633806", uz:"Sababli", en:"Excused", dot_uz:"S",  dot_en:"E", next:"present" },
};
const CYCLE = { present:"absent", absent:"excused", excused:"present" };

function Dot({ status, onClick, isUz, size=32 }) {
  const c = ATT[status] ?? ATT.present;
  return (
    <span onClick={onClick} className="att-dot"
      style={{ width:size, height:size, borderRadius:"50%", background:c.bg, color:c.tc,
        display:"inline-flex", alignItems:"center", justifyContent:"center",
        fontSize:size*0.35, fontWeight:500, cursor:"pointer", userSelect:"none",
        transition:"transform .1s, background .1s", flexShrink:0 }}
      onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
      {isUz ? c.dot_uz : c.dot_en}
    </span>
  );
}

function Sk() {
  return <div style={{ height:52, borderRadius:9, background:"var(--color-background-secondary)", animation:"pulse 1.4s ease-in-out infinite", marginBottom:4 }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </div>;
}

export default function Attendance() {
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const { lang } = useLang();
  const isUz = lang !== "en";

  if (P.attendance.noAccess) {
    return <NoAccess message="Davomatga ruxsatingiz yo'q"/>;
  }

  const today = new Date().toISOString().slice(0,10);
  const todayDisplay = new Date().toLocaleDateString("uz-UZ", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const [selGroupId,  setSelGroupId]  = useState(null);
  const [selLessonId, setSelLessonId] = useState(null);
  const [attState,    setAttState]    = useState({});
  const [saveMsg,     setSaveMsg]     = useState("");
  const [creating,    setCreating]    = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTime,     setNewTime]     = useState("10:00");
  const [newTopic,    setNewTopic]    = useState("");

  // Fetch groups (backend teacher role uchun o'zi filtrlab beradi)
  const { data: groupsRaw, loading: gLoading } = useApi(
    () => api.groups.list(
      isSuperAdmin ? {} : { branch_id: branchId }
    ),
    [branchId, isSuperAdmin]
  );
  const groups = groupsRaw?.data ?? (Array.isArray(groupsRaw) ? groupsRaw : []);

  // Fetch today's lessons for selected group
  const { data: lessonsRaw, loading: lLoading, refetch: refetchLessons } = useApi(
    () => selGroupId
      ? api.lessons.list({ group_id: selGroupId, date_from: today, date_to: today })
      : Promise.resolve({ data: [] }),
    [selGroupId]
  );
  const todayLessons = lessonsRaw?.data ?? lessonsRaw ?? [];

  // Fetch group detail (for students list)
  const { data: groupDetail, loading: stuLoading } = useApi(
    () => selGroupId ? api.groups.get(selGroupId) : Promise.resolve(null),
    [selGroupId]
  );
  const students = (groupDetail?.student_groups ?? []).filter(sg => sg.is_active);

  // Parallel: students endpoint dan id→student map (sg.student null bo'lsa fallback)
  const { data: studentsRaw } = useApi(
    () => selGroupId
      ? api.students.list({ ...(branchId ? { branch_id: branchId } : {}), limit: 200 })
      : Promise.resolve(null),
    [selGroupId, branchId]
  );
  const studentMap = Object.fromEntries(
    (studentsRaw?.data ?? []).map(s => [s.id, s])
  );

  // Selected lesson attendance
  const selLesson = todayLessons.find(l => l.id === selLessonId);

  // When lesson selected — pre-fill attState from existing attendance
  function selectLesson(lesson) {
    setSelLessonId(lesson.id);
    const init = {};
    (lesson.attendances ?? []).forEach(a => { init[a.student_id] = a.status; });
    // Default remaining students to "present"
    students.forEach(sg => {
      if (!init[sg.student_id]) init[sg.student_id] = "present";
    });
    setAttState(init);
    setSaveMsg("");
  }

  function toggle(sid) {
    setAttState(prev => ({ ...prev, [sid]: CYCLE[prev[sid] ?? "present"] ?? "present" }));
  }

  // Mark all present / all absent shortcut
  function markAll(status) {
    const next = {};
    students.forEach(sg => { next[sg.student_id] = status; });
    setAttState(next);
  }

  const { mutate: saveAttendance, loading: saving } = useMutation(
    (lessonId, entries) => api.lessons.markAttendance(lessonId, entries)
  );

  async function handleSave() {
    if (!selLessonId || !students.length) return;
    const entries = students.map(sg => ({
      student_id: sg.student_id,
      status:     attState[sg.student_id] ?? "present",
    }));
    try {
      await saveAttendance(selLessonId, entries);
      setSaveMsg("✅ Saqlandi!");
      refetchLessons();
      setTimeout(() => setSaveMsg(""), 2500);
    } catch(e) { alert(e.message); }
  }

  // Create new lesson for today
  async function handleCreateLesson() {
    if (!selGroupId) return;

    const selectedGroup = groups.find(g => g.id === selGroupId);
    const resolvedTeacherId = selectedGroup?.teacher_id ?? selectedGroup?.teacher?.id;
    if (!resolvedTeacherId) {
      alert(isUz
        ? "Bu guruhga o'qituvchi biriktirilmagan.\nGuruhlar bo'limiga o'ting va avval o'qituvchi biriktiring."
        : "No teacher assigned to this group.\nGo to Groups and assign a teacher first."
      );
      return;
    }

    setCreating(true);
    try {
      const [hh, mm] = newTime.split(":").map(Number);
      const endHh    = (hh + 2) % 24;
      const start_time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
      const end_time   = `${String(endHh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
      const payload = {
        group_id:    selGroupId,
        teacher_id:  resolvedTeacherId,
        lesson_date: today,
        start_time,
        end_time,
        topic:       newTopic || null,
      };
      const res = await api.lessons.create(payload);
      const newLesson = res?.data ?? res;
      setShowNewForm(false);
      setNewTopic("");
      setNewTime("10:00");
      await refetchLessons();
      if (newLesson?.id) {
        setTimeout(() => selectLesson({ ...newLesson, attendances: [] }), 200);
      }
    } catch(e) {
      alert(e.message ?? (isUz ? "Dars yaratishda xatolik yuz berdi" : "Failed to create lesson"));
    } finally {
      setCreating(false);
    }
  }

  // Stats
  const presentC = students.filter(sg=>(attState[sg.student_id]??"present")==="present").length;
  const absentC  = students.filter(sg=>attState[sg.student_id]==="absent").length;
  const excusedC = students.filter(sg=>attState[sg.student_id]==="excused").length;
  const total    = students.length;
  const pct      = total > 0 ? Math.round(presentC/total*100) : 0;
  const barColor = pct < 60 ? "#E24B4A" : pct < 80 ? "#BA7517" : "#1D9E75";

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>

      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:14, fontWeight:500, color:"var(--color-text-primary)" }}>Bugungi yo'qlama</div>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:1 }}>{todayDisplay}</div>
        </div>
      </div>

      <div className="att-layout" style={{ flex:1, display:"grid", gridTemplateColumns:"220px 1fr", overflow:"hidden" }}>

        {/* ── LEFT: Group + Lesson selector ─────────────────── */}
        <div className="att-left-panel" style={{ borderRight:"0.5px solid var(--color-border-tertiary)", overflow:"auto", background:"var(--color-background-primary)" }}>

          {/* Groups */}
          <div style={{ padding:"10px 12px 6px", fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".06em" }}>Guruh tanlang</div>
          {gLoading ? (
            <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>{Array(4).fill(0).map((_,i)=><Sk key={i}/>)}</div>
          ) : groups.length === 0 ? (
            <div style={{ padding:16, fontSize:12, color:"var(--color-text-secondary)", textAlign:"center" }}>Guruh topilmadi</div>
          ) : (
            <div style={{ padding:"0 8px 8px" }}>
              {groups.map(g => {
                const isSelected  = selGroupId === g.id;
                const hasTeacher  = g.teacher_id || g.teacher?.id;
                return (
                  <div key={g.id} onClick={() => { setSelGroupId(g.id); setSelLessonId(null); setAttState({}); }}
                    style={{ padding:"8px 10px", borderRadius:8, cursor:"pointer", marginBottom:3, transition:"all .1s",
                      background:isSelected?"#E1F5EE":"transparent",
                      border:isSelected?"0.5px solid #5DCAA5":"0.5px solid transparent",
                    }}
                    onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="var(--color-background-secondary)"; }}
                    onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background="transparent"; }}>
                    <div style={{ fontSize:12, fontWeight:isSelected?500:400, color:isSelected?"#085041":"var(--color-text-primary)" }}>{g.name}</div>
                    {!hasTeacher ? (
                      <div style={{ fontSize:10, color:"#A32D2D", marginTop:1 }}>⚠ O'qituvchi yo'q</div>
                    ) : (
                      <div style={{ fontSize:10, color:isSelected?"#1D9E75":"var(--color-text-secondary)", marginTop:1 }}>
                        {g.teacher?.full_name ?? g.schedule?.time ?? ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Today's lessons for selected group */}
          {selGroupId && (
            <>
              <div style={{ padding:"10px 12px 6px", borderTop:"0.5px solid var(--color-border-tertiary)", fontSize:10, fontWeight:500, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:".06em" }}>
                Bugungi darslar
              </div>
              <div style={{ padding:"0 8px 8px" }}>
                {lLoading ? <Sk/> : todayLessons.length === 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"12px 4px", textAlign:"center" }}>
                    <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="17" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                      <path d="M20 12v9l5 5" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                      {groups.find(g=>g.id===selGroupId)?.name} guruhida bugun dars yo'q
                    </span>
                    {P.lessons.canCreate && !showNewForm && (
                      <button onClick={() => setShowNewForm(true)}
                        style={{ padding:"7px 14px", borderRadius:8, background:"#1D9E75", color:"#fff", border:"none", fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"var(--font-sans)" }}>
                        + Bugun dars qo'shish
                      </button>
                    )}
                  </div>
                ) : todayLessons.map(lesson => {
                  const isSelected = selLessonId === lesson.id;
                  const hasAtt     = (lesson.attendances ?? []).length > 0;
                  return (
                    <div key={lesson.id} onClick={() => selectLesson(lesson)}
                      style={{ padding:"8px 10px", borderRadius:8, cursor:"pointer", marginBottom:3, transition:"all .1s",
                        background:isSelected?"#E6F1FB":"transparent",
                        border:isSelected?"0.5px solid #85B7EB":"0.5px solid transparent",
                      }}
                      onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="var(--color-background-secondary)"; }}
                      onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background="transparent"; }}>
                      <div style={{ fontSize:12, fontWeight:500, color:isSelected?"#0C447C":"var(--color-text-primary)" }}>
                        {lesson.start_time?.slice(0,5)} – {lesson.end_time?.slice(0,5)}
                      </div>
                      <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:1 }}>{lesson.topic || "Mavzusiz dars"}</div>
                      {hasAtt && (
                        <div style={{ marginTop:4, display:"flex", gap:4 }}>
                          <span style={{ background:"#E1F5EE", color:"#085041", padding:"1px 6px", borderRadius:8, fontSize:9 }}>
                            ✓ {(lesson.attendances??[]).filter(a=>a.status==="present").length}
                          </span>
                          <span style={{ background:"#FCEBEB", color:"#791F1F", padding:"1px 6px", borderRadius:8, fontSize:9 }}>
                            ✕ {(lesson.attendances??[]).filter(a=>a.status==="absent").length}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add another lesson button — shown when lessons already exist */}
                {P.lessons.canCreate && todayLessons.length > 0 && !showNewForm && (
                  <button onClick={() => setShowNewForm(true)}
                    style={{ width:"100%", padding:"7px 10px", borderRadius:8, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border:"0.5px dashed var(--color-border-tertiary)", background:"none", color:"var(--color-text-secondary)", marginTop:4, transition:"all .12s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="var(--color-background-secondary)"; e.currentTarget.style.color="var(--color-text-primary)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color="var(--color-text-secondary)"; }}>
                    + Bugun dars qo'shish
                  </button>
                )}

                {/* Inline new lesson form */}
                {showNewForm && (
                  <div style={{ padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:8, marginTop:4, display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ fontSize:10, fontWeight:500, color:"var(--color-text-secondary)" }}>YANGI DARS</div>
                    <input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)}
                      style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:6, padding:"5px 8px", fontSize:12, background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", outline:"none" }}/>
                    <input type="text" value={newTopic} onChange={e=>setNewTopic(e.target.value)}
                      placeholder="Mavzu (ixtiyoriy)"
                      style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:6, padding:"5px 8px", fontSize:12, background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", outline:"none" }}/>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => { setShowNewForm(false); setNewTopic(""); }}
                        style={{ flex:1, padding:"5px 0", borderRadius:6, border:"0.5px solid var(--color-border-tertiary)", background:"none", fontSize:11, cursor:"pointer", color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}>
                        Bekor
                      </button>
                      <button onClick={handleCreateLesson} disabled={creating}
                        style={{ flex:2, padding:"5px 0", borderRadius:6, border:"none", background:creating?"#5DCAA5":"#1D9E75", color:"#fff", fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)" }}>
                        {creating ? "..." : "Yaratish"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Attendance marking ─────────────────────── */}
        <div style={{ overflow:"auto", background:"var(--color-background-tertiary)" }}>
          {!selGroupId ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, color:"var(--color-text-secondary)", fontSize:13 }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="14" width="32" height="26" rx="5" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                <path d="M17 14V11a7 7 0 0114 0v3" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                <path d="M17 28h14M17 34h8" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Chap tarafdan guruhni tanlang
            </div>
          ) : !selLessonId ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10, color:"var(--color-text-secondary)", fontSize:13 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="22" r="17" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                <path d="M22 14v9l5 5" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {todayLessons.length === 0 ? "Bugun dars yo'q. Dars qo'shing." : "Darsni tanlang yoki yangi qo'shing"}
            </div>
          ) : (
            <div style={{ padding:16 }}>
              {/* Lesson header */}
              <div style={{ background:"var(--color-background-primary)", borderRadius:10, border:"0.5px solid var(--color-border-tertiary)", padding:14, marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500 }}>
                      {groups.find(g=>g.id===selGroupId)?.name} — {selLesson?.start_time?.slice(0,5)}
                    </div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>
                      {selLesson?.topic || "Mavzusiz dars"} · {today}
                    </div>
                  </div>
                  {/* Quick mark all */}
                  {P.attendance.canMark && (
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>markAll("present")}
                        style={{ padding:"5px 12px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", background:"#E1F5EE", color:"#085041", border:"0.5px solid #5DCAA5", transition:"all .12s" }}>
                        Hammasi keldi ✓
                      </button>
                      <button onClick={()=>markAll("absent")}
                        style={{ padding:"5px 12px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", background:"#FCEBEB", color:"#791F1F", border:"0.5px solid #F09595", transition:"all .12s" }}>
                        Hammasi kelmadi
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {total > 0 && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--color-text-secondary)", marginBottom:5 }}>
                      <span>Davomat</span>
                      <span style={{ fontWeight:500, color:barColor }}>{presentC}/{total} ({pct}%)</span>
                    </div>
                    <ProgressBar percent={pct} color={barColor} height={6}/>
                    <div style={{ display:"flex", gap:12, marginTop:8 }}>
                      {[{l:"Keldi",v:presentC,c:"#1D9E75"},{l:"Kelmadi",v:absentC,c:"#A32D2D"},{l:"Sababli",v:excusedC,c:"#BA7517"}].map(item=>(
                        <div key={item.l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:item.c }}/>
                          <span style={{ color:"var(--color-text-secondary)" }}>{item.l}:</span>
                          <span style={{ fontWeight:500, color:item.c }}>{item.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:12, marginBottom:10, alignItems:"center", flexWrap:"wrap" }}>
                {Object.entries(ATT).map(([key,cfg])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"var(--color-text-secondary)" }}>
                    <span style={{ width:22, height:22, borderRadius:"50%", background:cfg.bg, color:cfg.tc, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:500 }}>{cfg.dot_uz}</span>
                    {cfg.uz}
                  </div>
                ))}
                <span style={{ fontSize:11, color:"var(--color-text-secondary)", marginLeft:"auto" }}>Bosib holat o'zgartiring</span>
              </div>

              {/* Students list */}
              {stuLoading ? (
                Array(5).fill(0).map((_,i)=><Sk key={i}/>)
              ) : students.length === 0 ? (
                <div style={{ textAlign:"center", padding:24, color:"var(--color-text-secondary)", fontSize:12 }}>Bu guruhda hali talaba yo'q</div>
              ) : (
                <div style={{ background:"var(--color-background-primary)", borderRadius:10, border:"0.5px solid var(--color-border-tertiary)", overflow:"hidden" }}>
                  {students.map((sg, i) => {
                    const stu    = sg.student ?? studentMap[sg.student_id] ?? {};
                    const status = attState[sg.student_id] ?? "present";
                    const cfg    = ATT[status];
                    const ini    = (stu.full_name ?? "?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

                    return (
                      <div key={sg.id}
                        onClick={P.attendance.canMark ? ()=>toggle(sg.student_id) : undefined}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                          borderBottom: i < students.length-1 ? "0.5px solid var(--color-border-tertiary)" : "none",
                          background: i%2===0 ? "transparent" : "var(--color-background-secondary)",
                          cursor: P.attendance.canMark ? "pointer" : "default",
                          transition:"background .1s",
                        }}
                        onMouseEnter={e=>{ if(P.attendance.canMark) e.currentTarget.style.background="var(--color-background-secondary)"; }}
                        onMouseLeave={e=>{ if(i%2!==0 || !P.attendance.canMark) {} else e.currentTarget.style.background="transparent"; }}>

                        {/* Avatar — color changes with status */}
                        <div style={{ width:34, height:34, borderRadius:"50%", background:cfg.bg, color:cfg.tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, flexShrink:0, transition:"background .15s" }}>
                          {ini}
                        </div>

                        {/* Name */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {stu.full_name ?? "(Yuklanmadi)"}
                          </div>
                          {stu.phone && <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{stu.phone}</div>}
                        </div>

                        {/* Status badge + dot */}
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:11, color:cfg.tc, background:cfg.bg, padding:"3px 10px", borderRadius:20, fontWeight:500 }}>
                            {cfg.uz}
                          </span>
                          {P.attendance.canMark && (
                            <Dot status={status} onClick={(e)=>{ e.stopPropagation(); toggle(sg.student_id); }} isUz={isUz} size={28}/>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Save button */}
              {P.attendance.canMark && students.length > 0 && (
                <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <button onClick={handleSave} disabled={saving} className="save-btn"
                    style={{ padding:"9px 24px", borderRadius:9, background:saving?"#5DCAA5":"#1D9E75", color:"#fff", border:"none", fontSize:13, fontWeight:500, cursor:saving?"default":"pointer", fontFamily:"var(--font-sans)", transition:"background .12s" }}>
                    {saving ? "Saqlanmoqda..." : "💾 Davomatni saqlash"}
                  </button>
                  {saveMsg && (
                    <span style={{ fontSize:13, color:"#1D9E75", fontWeight:500 }}>{saveMsg}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
