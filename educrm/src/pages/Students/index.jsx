import { useState, useEffect } from "react";
import StudentDetail from "./StudentDetail";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { AVA_PALETTES } from "../../data/mockData";
import {
  Avatar, Badge, KpiCard, FilterPills, SearchBar, Button,
  Modal, FormField, Input, Select, ModalButtons,
  Table, TableRow, Td, EmptyState, NoAccess, ReadOnlyBanner,
} from "../../components/ui";

const STATUS_PRESET = { active:"green", stopped:"red", new:"blue" };

function initials(n){ return (n??"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"??"; }
function paletteFor(id){ return AVA_PALETTES[(id??0)%AVA_PALETTES.length]; }

export default function Students() {
  const { t, lang } = useLang();
  const s = t.students;
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const p = P.students;

  const [students, setStudents] = useState([]);
  const [meta,     setMeta]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [query,    setQuery]    = useState("");
  const [page,     setPage]     = useState(1);
  const [modal,    setModal]    = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [view,     setView]     = useState("table");
  const [form,     setForm]     = useState({ firstName:"", lastName:"", phone:"", parentPhone:"", group:"" });

  const { data: branchesRaw } = useApi(() => api.branches.list(), []);
  const branches = branchesRaw?.data ?? branchesRaw ?? [];
  const firstBranch = branches[0];

  const { data: groupsRaw } = useApi(
    () => api.groups.list(isSuperAdmin ? {} : { branch_id: branchId }),
    [branchId]
  );
  const availableGroups = groupsRaw?.data ?? (Array.isArray(groupsRaw) ? groupsRaw : []);

  const { mutate: createStudent, loading: saving } = useMutation(api.students.create);

  useEffect(() => { loadStudents(); }, [filter, query, page, branchId, isSuperAdmin]);

  async function loadStudents() {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (!isSuperAdmin && branchId) params.branch_id = branchId;
      if (filter !== "all") params.status = filter;
      if (query) params.q = query;

      const [studRes, groupRes] = await Promise.all([
        api.students.list(params),
        api.groups.list(isSuperAdmin ? {} : { branch_id: branchId }),
      ]);

      const studs = studRes?.data ?? [];
      const allGroups = Array.isArray(groupRes) ? groupRes : groupRes?.data ?? [];

      // Build map: student_id → group name
      const groupMap = {};
      allGroups.forEach(g => {
        (g.student_groups ?? []).forEach(sg => {
          if (sg.is_active) groupMap[sg.student_id] = g.name;
        });
      });

      setStudents(studs.map(s => ({ ...s, group_name: groupMap[s.id] ?? "—" })));
      setMeta(studRes?.meta ?? {});
    } catch(e) {
      console.error("Students load error:", e);
    } finally {
      setLoading(false);
    }
  }

  const newCount = students.filter(st => st.status === "new").length;

  async function handleSave() {
    const { firstName, lastName, phone } = form;
    if (!firstName || !lastName || !phone) return;
    const normalizedPhone = phone.replace(/[^\d+]/g, "");
    try {
      const res = await createStudent({ branch_id: branchId ?? firstBranch?.id, full_name:`${firstName} ${lastName}`, phone: normalizedPhone, status:"new" });
      const studentId = res?.data?.id ?? res?.id;
      if (studentId && form.group) {
        try { await api.groups.addStudent(Number(form.group), studentId); } catch(_) {}
      }
      setModal(false);
      setForm({ firstName:"", lastName:"", phone:"", parentPhone:"", group:"" });
      loadStudents();
    } catch(e){ alert(e.message); }
  }

  if (selectedStudentId) {
    return (
      <StudentDetail
        studentId={selectedStudentId}
        onBack={() => setSelectedStudentId(null)}
      />
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>
      {p.isLimited && (
        <ReadOnlyBanner message={P.is.teacher
          ? (lang==="en" ? "You only see your group's students" : "Siz faqat o'z guruhingiz talabalarini ko'rasiz")
          : (lang==="en" ? "View only" : "Faqat ko'rish rejimi")} />
      )}

      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{s.title}</span>
        <SearchBar value={query} onChange={v=>{setQuery(v);setPage(1);}} placeholder={s.search} style={{ flex:"1 1 auto", minWidth:120, maxWidth:260 }}/>
        <div style={{ display:"flex", background:"rgba(0,0,0,.06)", borderRadius:8, overflow:"hidden" }}>
          {[["table","☰"],["kanban","⊞"]].map(([v,icon])=>(
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:"5px 10px", fontSize:13, cursor:"pointer", fontFamily:"var(--font-sans)", border:"none", background:view===v?"#1D9E75":"transparent", color:view===v?"#fff":"var(--color-text-secondary)" }}>
              {icon}
            </button>
          ))}
        </div>
        {p.canCreate && <Button onClick={()=>setModal(true)}>{s.add}</Button>}
      </div>

      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:8, marginBottom:12 }}>
          <KpiCard label={s.stats.total}    value={meta.total??students.length} sub={`+${newCount} ${lang==="en"?"new":"yangi"}`} subColor="#1D9E75"/>
          <KpiCard label={s.stats.active}   value={students.filter(st=>st.status==="active").length}/>
          <KpiCard label={s.stats.debtors}  value={0} subColor="#A32D2D"/>
          <KpiCard label={s.stats.newMonth} value={newCount}/>
        </div>

        <FilterPills options={s.filters} keys={s.filterKeys} active={filter} onChange={k=>{setFilter(k);setPage(1);}}/>

        {loading ? (
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:100,color:"var(--color-text-secondary)",fontSize:12 }}>
            {lang==="en" ? "Loading..." : "Yuklanmoqda..."}
          </div>
        ) : view === "table" ? (
          <>
            {/* Desktop table */}
            <div className="desktop-only">
              <Table headers={[s.table.name, s.table.group, s.table.status, s.table.payment, s.table.joined]}>
                {students.length ? students.map(st => (
                  <TableRow key={st.id}>
                    <Td>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Avatar av={initials(st.full_name)} palette={paletteFor(st.id)}/>
                        <div>
                          <div
                            style={{ fontWeight:500, fontSize:12, color:"#1D9E75", cursor:"pointer", textDecoration:"underline", textDecorationStyle:"dotted" }}
                            onClick={() => setSelectedStudentId(st.id)}>
                            {st.full_name}
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{st.phone}</div>
                        </div>
                      </div>
                    </Td>
                    <Td style={{ fontSize:12 }}>{st.group_name ?? "—"}</Td>
                    <Td><Badge preset={STATUS_PRESET[st.status]||"gray"}>{s.status[st.status]??st.status}</Badge></Td>
                    <Td><Badge preset="gray">—</Badge></Td>
                    <Td style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{st.created_at?.slice(0,7)}</Td>
                  </TableRow>
                )) : <tr><td colSpan={5}><EmptyState message={s.noData}/></td></tr>}
              </Table>
            </div>

            {/* Mobile card list */}
            <div className="mobile-only" style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {students.length === 0 && <EmptyState message={s.noData}/>}
              {students.map(st => (
                <div key={st.id}
                  onClick={() => setSelectedStudentId(st.id)}
                  style={{
                    background:"var(--color-background-primary)",
                    border:"0.5px solid var(--color-border-tertiary)",
                    borderRadius:10, padding:"12px 14px", cursor:"pointer",
                  }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:6 }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:paletteFor(st.id).bg, color:paletteFor(st.id).tc, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:500, flexShrink:0 }}>
                      {initials(st.full_name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{st.full_name}</div>
                      <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{st.phone}</div>
                    </div>
                    <Badge preset={STATUS_PRESET[st.status]||"gray"}>{s.status[st.status]??st.status}</Badge>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--color-text-secondary)" }}>
                    <span>{s.table.group}: {st.group_name ?? "—"}</span>
                    <span>{st.created_at?.slice(0,7)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, alignItems:"start" }}>
            {[
              { key:"new",     label: lang==="en" ? "New"     : "Yangi",          color:"#1D9E75", bg:"#E1F5EE" },
              { key:"active",  label: lang==="en" ? "Active"  : "Aktiv",          color:"#1D62C8", bg:"#E6F1FB" },
              { key:"stopped", label: lang==="en" ? "Stopped" : "To'xtatilgan",   color:"#A32D2D", bg:"#FDEDF4" },
            ].map(col => {
              const colStudents = students.filter(st => st.status === col.key);
              return (
                <div key={col.key} style={{ background:"var(--color-background-secondary)", borderRadius:10, overflow:"hidden", border:"0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ padding:"8px 12px", background:col.bg, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:12, fontWeight:600, color:col.color }}>{col.label}</span>
                    <span style={{ fontSize:11, fontWeight:500, color:col.color, background:"rgba(255,255,255,.5)", borderRadius:10, padding:"1px 8px" }}>{colStudents.length}</span>
                  </div>
                  <div style={{ padding:8, display:"flex", flexDirection:"column", gap:6 }}>
                    {colStudents.length === 0 && (
                      <div style={{ textAlign:"center", fontSize:11, color:"var(--color-text-secondary)", padding:"20px 0" }}>
                        {lang==="en" ? "No students" : "Talaba yo'q"}
                      </div>
                    )}
                    {colStudents.map(st => (
                      <div key={st.id} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8, padding:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                          <Avatar av={initials(st.full_name)} palette={paletteFor(st.id)} size={30}/>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{st.full_name}</div>
                            <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{st.phone}</div>
                          </div>
                        </div>
                        <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:3 }}>{st.group_name ?? "—"}</div>
                        <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>{st.created_at?.slice(0,10)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {meta.pages>1 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:12 }}>
            {Array.from({length:meta.pages},(_,i)=>i+1).map(pg=>(
              <button key={pg} onClick={()=>setPage(pg)}
                style={{ width:30, height:30, borderRadius:6, border:"0.5px solid var(--color-border-tertiary)", background:page===pg?"#1D9E75":"var(--color-background-primary)", color:page===pg?"#fff":"var(--color-text-secondary)", cursor:"pointer", fontSize:12, fontFamily:"var(--font-sans)" }}>
                {pg}
              </button>
            ))}
          </div>
        )}
      </div>

      {p.canCreate && (
        <Modal open={modal} onClose={()=>setModal(false)}>
          <div style={{ fontSize:14, fontWeight:500 }}>{s.form.title}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <FormField label={s.form.firstName}><Input value={form.firstName} onChange={v=>setForm(p=>({...p,firstName:v}))} placeholder="Dilnoza"/></FormField>
            <FormField label={s.form.lastName}><Input value={form.lastName} onChange={v=>setForm(p=>({...p,lastName:v}))} placeholder="Yusupova"/></FormField>
          </div>
          <FormField label={s.form.phone}><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+998 90 000 00 00"/></FormField>
          <FormField label={s.form.parentPhone}><Input value={form.parentPhone} onChange={v=>setForm(p=>({...p,parentPhone:v}))} placeholder="+998 90 000 00 00"/></FormField>
          <FormField label={s.form.group}>
            <Select value={form.group} onChange={v=>setForm(p=>({...p,group:v}))}>
              <option value="">{s.form.groupPlaceholder}</option>
              {availableGroups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </FormField>
          <ModalButtons>
            <Button variant="ghost" onClick={()=>setModal(false)}>{s.form.cancel}</Button>
            <Button onClick={handleSave} style={{ opacity:saving?.6:1 }}>{saving?"...":s.form.save}</Button>
          </ModalButtons>
        </Modal>
      )}
    </div>
  );
}