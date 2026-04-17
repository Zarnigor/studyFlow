import { useState } from "react";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { COURSES, AVA_PALETTES, STAGE_COLORS, SOURCE_COLORS } from "../../data/mockData";
import { Avatar, Badge, Button, SearchBar, Modal, FormField, Input, Select, Textarea, ModalButtons, Table, TableRow, Td, ProgressBar, EmptyState, NoAccess } from "../../components/ui";

function initials(n){ return (n??"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"??"; }
function paletteFor(id){ return AVA_PALETTES[(id??0)%AVA_PALETTES.length]; }
const stageColor  = si => STAGE_COLORS[si]??STAGE_COLORS[0];
const sourceColor = src => SOURCE_COLORS[src]??{bg:"var(--color-background-secondary)",tc:"var(--color-text-secondary)"};
const stageIdx    = { new:0, called:1, trial:2, enrolled:3, rejected:4 };

export default function Leads() {
  const { t } = useLang();
  const l = t.leads;
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const perm = P.leads;

  if (perm.noAccess) {
    return <NoAccess
      message="Arizalar bo'limine ruxsatingiz yo'q"
      hint={P.is.cashier ? "Kassirlar faqat to'lovlarni boshqaradi" : "Bu bo'lim admin va menejerlar uchun"}
    />;
  }

  const [view,  setView]  = useState("kanban");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [form,  setForm]  = useState({ name:"", phone:"", course:COURSES[0], source:"", stage:0, note:"" });
  const [editF, setEditF] = useState({});

  const { data, loading, refetch } = useApi(
    () => api.leads.list({ branch_id: isSuperAdmin ? undefined : branchId, q: query || undefined, limit: 100 }),
    [query, branchId]
  );
  const leads = (data?.data ?? []).map(ld=>({...ld, stage_idx:stageIdx[ld.stage]??-1}));
  const stageCounts = [0,1,2,3,4].map(i=>leads.filter(ld=>ld.stage_idx===i).length);

  const { mutate:createLead } = useMutation(api.leads.create);
  const { mutate:updateLead } = useMutation((id,d)=>api.leads.update(id,d));
  const { mutate:deleteLead } = useMutation(id=>api.leads.delete(id));

  const stageKeys = ["new","called","trial","enrolled","rejected"];

  async function moveFwd(id, si){ if(si>=4) return; await updateLead(id,{stage:stageKeys[si+1]}); refetch(); }
  async function handleDelete(id){ await deleteLead(id); if(modal?.id===id) setModal(null); refetch(); }
  async function saveAdd(){
    if(!form.name||!form.phone) return;
    try {
      await createLead({ branch_id: branchId ?? leads[0]?.branch_id, full_name:form.name, phone:form.phone, course_interest:form.course, source:form.source||"other", stage:stageKeys[Number(form.stage)]??"new", notes:form.note });
      setModal(null); refetch();
    } catch(e){ alert(e.message); }
  }
  async function saveDetail(){
    if(!modal) return;
    await updateLead(modal.id,{ stage:stageKeys[Number(editF.stage??modal.stage_idx)]??editF.stage??modal.stage, course_interest:editF.course??modal.course_interest, source:editF.source??modal.source, notes:editF.note??modal.notes });
    setModal(null); refetch();
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{l.title}</span>
        <SearchBar value={query} onChange={setQuery} placeholder={l.search}/>
        <div style={{ display:"flex", background:"var(--color-background-secondary)", borderRadius:8, overflow:"hidden", border:"0.5px solid var(--color-border-tertiary)" }}>
          {["kanban","list"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border:"none", background:view===v?"var(--color-background-primary)":"transparent", color:view===v?"var(--color-text-primary)":"var(--color-text-secondary)", fontWeight:view===v?500:400 }}>
              {l.views[v]}
            </button>
          ))}
        </div>
        {perm.canCreate && <Button onClick={()=>{ setForm({name:"",phone:"",course:COURSES[0],source:l.sources[0],stage:0,note:""}); setModal("add"); }} style={{ marginLeft:"auto" }}>{l.add}</Button>}
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"var(--color-background-tertiary)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(90px, 1fr))", gap:8, padding:"12px 16px 0" }}>
          {l.stats.map((label,i)=>(
            <div key={label} style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:500, color:["var(--color-text-primary)","#185FA5","#BA7517","#1D9E75","#A32D2D"][i] }}>{stageCounts[i]}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--color-text-secondary)", fontSize:12 }}>Yuklanmoqda...</div>
        ) : view==="kanban" ? (
          <div style={{ display:"flex", gap:10, padding:"12px 16px", overflowX:"auto", flex:1, alignItems:"flex-start", WebkitOverflowScrolling:"touch", scrollSnapType:"x mandatory" }}>
            {l.stages.map((stageName,si)=>{
              const sc = stageColor(si);
              const stageLeads = leads.filter(ld=>ld.stage_idx===si);
              return (
                <div key={si} className="kanban-col" style={{ width:200, flexShrink:0, scrollSnapAlign:"start" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:8, marginBottom:6, background:sc.bg }}>
                    <span style={{ fontSize:11, fontWeight:500, color:sc.tc }}>{stageName}</span>
                    <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${sc.tc}22`, color:sc.tc }}>{stageLeads.length}</span>
                  </div>
                  {stageLeads.length ? stageLeads.map(ld=>{
                    const src=sourceColor(ld.source);
                    return (
                      <div key={ld.id} onClick={()=>{ setEditF({stage:ld.stage_idx,course:ld.course_interest,source:ld.source,note:ld.notes}); setModal(ld); }}
                        style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:11, cursor:"pointer", marginBottom:6, transition:"border-color .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="#1D9E75"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary)"}>
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:6 }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500 }}>{ld.full_name}</div>
                            <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{ld.phone}</div>
                          </div>
                          <div style={{ display:"flex", gap:3 }} onClick={e=>e.stopPropagation()}>
                            {ld.stage_idx<4 && perm.canEdit && (
                              <button onClick={()=>moveFwd(ld.id,ld.stage_idx)} title={l.stages[ld.stage_idx+1]} style={{ width:22,height:22,borderRadius:6,border:"0.5px solid var(--color-border-tertiary)",background:"none",cursor:"pointer",fontSize:13,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",justifyContent:"center" }} onMouseEnter={e=>{e.currentTarget.style.background="#E1F5EE";e.currentTarget.style.color="#085041";}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--color-text-secondary)";}}>›</button>
                            )}
                            {ld.stage_idx<4 && perm.canEdit && (
                              <button onClick={async()=>{ await updateLead(ld.id,{stage:"rejected"}); refetch(); }} title="Rad etish" style={{ width:22,height:22,borderRadius:6,border:"0.5px solid var(--color-border-tertiary)",background:"none",cursor:"pointer",fontSize:11,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",justifyContent:"center" }} onMouseEnter={e=>{e.currentTarget.style.background="#FCEBEB";e.currentTarget.style.color="#791F1F";e.currentTarget.style.borderColor="#F09595";}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--color-text-secondary)";e.currentTarget.style.borderColor="var(--color-border-tertiary)";}}>✕</button>
                            )}
                            {perm.canDelete && (
                              <button onClick={()=>handleDelete(ld.id)} title="O'chirish" style={{ width:22,height:22,borderRadius:6,border:"0.5px solid var(--color-border-tertiary)",background:"none",cursor:"pointer",fontSize:13,color:"var(--color-text-secondary)",display:"flex",alignItems:"center",justifyContent:"center" }} onMouseEnter={e=>{e.currentTarget.style.background="#FCEBEB";e.currentTarget.style.color="#791F1F";}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--color-text-secondary)";}}>🗑</button>
                            )}
                          </div>
                        </div>
                        <span style={{ display:"inline-flex",padding:"2px 7px",borderRadius:10,fontSize:10,background:src.bg,color:src.tc,marginBottom:5 }}>{ld.source}</span>
                        <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{ld.course_interest}</div>
                        <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:4 }}>{ld.created_at?.slice(5,10)}</div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding:16,textAlign:"center",fontSize:11,color:"var(--color-text-secondary)",background:"var(--color-background-primary)",borderRadius:10,border:"0.5px dashed var(--color-border-tertiary)" }}>{l.noLeads}</div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ flex:1, overflowY:"auto", padding:"10px 16px" }}>
            <Table headers={Object.values(l.table)}>
              {leads.length ? leads.map(ld=>{
                const sc=stageColor(ld.stage_idx); const src=sourceColor(ld.source);
                return (
                  <TableRow key={ld.id} onClick={()=>{ setEditF({stage:ld.stage_idx,course:ld.course_interest,source:ld.source,note:ld.notes}); setModal(ld); }}>
                    <Td><div style={{ display:"flex",alignItems:"center",gap:8 }}><Avatar av={initials(ld.full_name)} palette={paletteFor(ld.id)}/><div><div style={{ fontWeight:500,fontSize:12 }}>{ld.full_name}</div><div style={{ fontSize:10,color:"var(--color-text-secondary)" }}>{ld.phone}</div></div></div></Td>
                    <Td style={{ fontSize:12 }}>{ld.course_interest}</Td>
                    <Td><span style={{ display:"inline-flex",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:500,background:src.bg,color:src.tc }}>{ld.source}</span></Td>
                    <Td style={{ fontSize:11,color:"var(--color-text-secondary)" }}>{ld.created_at?.slice(0,10)}</Td>
                    <Td><span style={{ display:"inline-flex",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:500,background:sc.bg,color:sc.tc }}>{ld.stage_idx>=0 ? l.stages[ld.stage_idx] : (ld.stage ?? "Noma'lum")}</span></Td>
                    <Td style={{ fontSize:11,color:"var(--color-text-secondary)",maxWidth:120,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis" }}>{ld.notes||"—"}</Td>
                  </TableRow>
                );
              }) : <tr><td colSpan={6}><EmptyState message={l.noLeads}/></td></tr>}
            </Table>
          </div>
        )}
      </div>

      <Modal open={modal==="add"} onClose={()=>setModal(null)}>
        <div style={{ fontSize:14, fontWeight:500 }}>{l.form.addTitle}</div>
        <FormField label={l.form.name}><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Ism Familiya"/></FormField>
        <FormField label={l.form.phone}><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+998 90 000 00 00"/></FormField>
        <FormField label={l.form.course}><Select value={form.course} onChange={v=>setForm(p=>({...p,course:v}))}>{COURSES.map(c=><option key={c}>{c}</option>)}</Select></FormField>
        <FormField label={l.form.source}><Select value={form.source} onChange={v=>setForm(p=>({...p,source:v}))}>{l.sources.map(s=><option key={s}>{s}</option>)}</Select></FormField>
        <FormField label={l.form.stage}><Select value={form.stage} onChange={v=>setForm(p=>({...p,stage:v}))}>{l.stages.map((s,i)=><option key={i} value={i}>{s}</option>)}</Select></FormField>
        <FormField label={l.form.note}><Textarea value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Izoh..."/></FormField>
        <ModalButtons>
          <Button variant="ghost" onClick={()=>setModal(null)}>{l.form.cancel}</Button>
          <Button onClick={saveAdd}>{l.form.save}</Button>
        </ModalButtons>
      </Modal>

      <Modal open={modal&&modal!=="add"} onClose={()=>setModal(null)} side>
        {modal&&modal!=="add"&&(
          <>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ fontSize:14,fontWeight:500 }}>{modal.full_name}</div>
              <button onClick={()=>setModal(null)} style={{ background:"none",border:"none",cursor:"pointer",fontSize:18,color:"var(--color-text-secondary)",lineHeight:1 }}>×</button>
            </div>
            <div style={{ fontSize:10,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".06em" }}>Holat o'zgartirish</div>
            <FormField label={l.form.stage}><Select value={editF.stage??modal.stage_idx} onChange={v=>setEditF(p=>({...p,stage:v}))}>{l.stages.map((s,i)=><option key={i} value={i}>{s}</option>)}</Select></FormField>
            <FormField label={l.form.course}><Select value={editF.course??modal.course_interest??""} onChange={v=>setEditF(p=>({...p,course:v}))}>{COURSES.map(c=><option key={c}>{c}</option>)}</Select></FormField>
            <FormField label={l.form.source}><Select value={editF.source??modal.source??""} onChange={v=>setEditF(p=>({...p,source:v}))}>{l.sources.map(s=><option key={s}>{s}</option>)}</Select></FormField>
            <FormField label={l.form.note}><Textarea value={editF.note??modal.notes??""} onChange={v=>setEditF(p=>({...p,note:v}))} placeholder="Izoh..."/></FormField>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end",marginTop:4 }}>
              {perm.canDelete && <Button variant="danger" onClick={()=>handleDelete(modal.id)}>{l.form.delete}</Button>}
              <Button variant="ghost" onClick={()=>setModal(null)}>{l.form.cancel}</Button>
              {perm.canEdit && <Button onClick={saveDetail}>{l.form.save}</Button>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
