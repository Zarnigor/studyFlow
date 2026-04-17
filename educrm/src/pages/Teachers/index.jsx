import { useState } from "react";
import { usePermissions } from "../../auth/permissions";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { AVA_PALETTES } from "../../data/mockData";
import { Avatar, Badge, Button, Modal, FormField, Input, Select, ModalButtons, NoAccess } from "../../components/ui";

function initials(n) { return (n??"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"??"; }
function paletteFor(id) { return AVA_PALETTES[(id??0)%AVA_PALETTES.length]; }

export default function Teachers() {
  const { t, lang } = useLang();
  const tc = t.teachers;
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const perm = P.teachers;
  if (perm.noAccess) return <NoAccess message="Bu bo'limga ruxsatingiz yo'q"/>;


  const { data, loading, refetch } = useApi(
    () => api.teachers.list({ branch_id: isSuperAdmin ? undefined : branchId }),
    [branchId]
  );
  const teachers = data?.data ?? data ?? [];

  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState({ firstName:"", lastName:"", phone:"", subject:"English", salaryType:"percent", salaryValue:"30", createLogin:false, password:"teacher123" });

  const { mutate: createTeacher, loading: saving } = useMutation(api.teachers.create);

  async function handleDeactivate(id) {
    if (!confirm("O'qituvchini deaktivatsiya qilish?")) return;
    try { await api.teachers.update(id, { is_active: false }); refetch(); } catch(e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!confirm("O'qituvchini o'chirish? Bu amalni qaytarib bo'lmaydi.")) return;
    try { await api.teachers.delete(id); refetch(); } catch(e) { alert(e.message); }
  }

  async function handleSave() {
    const { firstName, lastName } = form;
    if (!firstName || !lastName) return;
    try {
      const teacher = await createTeacher({
        branch_id:    branchId,
        full_name:    `${firstName} ${lastName}`,
        phone:        form.phone || "+998000000000",
        salary_type:  form.salaryType,
        salary_value: parseFloat(form.salaryValue) || 0,
      });

      // If createLogin is checked, create user account and link it to the teacher
      if (form.createLogin && form.phone && form.password) {
        try {
          const newUser = await api.users.create({
            full_name:  `${firstName} ${lastName}`,
            phone:      form.phone,
            password:   form.password,
            role:       "teacher",
            branch_id:  branchId,
          });
          if (newUser?.id) {
            await api.teachers.update(teacher.id, { user_id: newUser.id });
          }
        } catch(userErr) {
          alert(
            lang==="en"
              ? `Teacher created but login account failed: ${userErr.message}`
              : `O'qituvchi yaratildi, lekin login yaratishda xato: ${userErr.message}`
          );
        }
      }

      setModal(false);
      setForm({ firstName:"", lastName:"", phone:"", subject:"English", salaryType:"percent", salaryValue:"30", createLogin:false, password:"teacher123" });
      refetch();
    } catch(e) { alert(e.message ?? (lang==="en" ? "Error occurred" : "Xatolik yuz berdi")); }
  }

  function salaryLabel(teacher) {
    if (teacher.salary_type === "percent") {
      const stuCount = Number(teacher.students) || 0;
      const salVal   = Number(teacher.salary_value) || 0;
      const est = stuCount > 0
        ? Math.round(stuCount * 500000 * salVal / 100)
        : 0;
      return `${salVal}%${stuCount > 0 ? ` ≈ ${est.toLocaleString()} so'm` : ""}`;
    }
    return `${Number(teacher.salary_value).toLocaleString()} ${tc.currency}`;
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{tc.title}</span>
        {perm.canCreate && <Button onClick={()=>setModal(true)} style={{ marginLeft:"auto" }}>{tc.add}</Button>}
      </div>

      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>
        {loading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:120, color:"var(--color-text-secondary)", fontSize:12 }}>Yuklanmoqda...</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
            {teachers.map(teacher => (
              <div key={teacher.id}
                style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:14, display:"flex", flexDirection:"column", gap:10, cursor:"pointer", transition:"border-color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#1D9E75"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary)"}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <Avatar av={initials(teacher.full_name)} palette={paletteFor(teacher.id)} size={38}/>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>{teacher.full_name}</div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>
                      {teacher.subject_id ?? "Fan"}
                    </div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)", marginTop:2 }}>{teacher.phone}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {[{ label:tc.cols.groups, value:Array.isArray(teacher.groups)?teacher.groups.length:0 },{ label:tc.cols.students, value:teacher.students??0 }].map(m => (
                    <div key={m.label} style={{ background:"var(--color-background-secondary)", borderRadius:6, padding:"6px 8px" }}>
                      <div style={{ fontSize:9, color:"var(--color-text-secondary)", marginBottom:2, textTransform:"uppercase", letterSpacing:".04em" }}>{m.label}</div>
                      <div style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{m.value}</div>
                    </div>
                  ))}
                  <div style={{ background:"var(--color-background-secondary)", borderRadius:6, padding:"6px 8px", gridColumn:"span 2" }}>
                    <div style={{ fontSize:9, color:"var(--color-text-secondary)", marginBottom:2, textTransform:"uppercase", letterSpacing:".04em" }}>{tc.cols.salary}</div>
                    <div style={{ fontSize:11, fontWeight:500, color:"var(--color-text-primary)" }}>{salaryLabel(teacher)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {(teacher.groups??[]).length
                    ? (teacher.groups??[]).map(g => <Badge key={g.id ?? g} preset="gray">{g.name ?? g}</Badge>)
                    : <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>Guruh biriktirilmagan</span>}
                </div>
                {(perm.canEdit || perm.canCreate) && (
                  <div style={{ display:"flex", gap:5, borderTop:"0.5px solid var(--color-border-tertiary)", paddingTop:8 }}>
                    {perm.canEdit && teacher.is_active !== false && (
                      <button onClick={e=>{e.stopPropagation();handleDeactivate(teacher.id);}}
                        style={{ flex:1, padding:"5px 0", fontSize:11, borderRadius:6, border:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)", color:"var(--color-text-secondary)", cursor:"pointer", fontFamily:"var(--font-sans)" }}>
                        Deaktiv
                      </button>
                    )}
                    {perm.canCreate && (
                      <button onClick={e=>{e.stopPropagation();handleDelete(teacher.id);}}
                        style={{ flex:1, padding:"5px 0", fontSize:11, borderRadius:6, border:"0.5px solid #F5C0C0", background:"#FEF2F2", color:"#B91C1C", cursor:"pointer", fontFamily:"var(--font-sans)" }}>
                        O'chirish
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!loading && teachers.length === 0 && (
              <div style={{ gridColumn:"1/-1", textAlign:"center", color:"var(--color-text-secondary)", fontSize:12, padding:40 }}>O'qituvchi topilmadi</div>
            )}
          </div>
        )}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)}>
        <div style={{ fontSize:14, fontWeight:500 }}>{tc.form.title}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <FormField label={tc.form.firstName}><Input value={form.firstName} onChange={v=>setForm(p=>({...p,firstName:v}))} placeholder="Kamola"/></FormField>
          <FormField label={tc.form.lastName}><Input value={form.lastName} onChange={v=>setForm(p=>({...p,lastName:v}))} placeholder="Yusupova"/></FormField>
        </div>
        <FormField label={tc.form.phone}><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+998 90 000 00 00"/></FormField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <FormField label={tc.form.subject}>
            <Select value={form.subject} onChange={v=>setForm(p=>({...p,subject:v}))}>
              {["English","Mathematics","Russian","IELTS","IT"].map(s => <option key={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label={tc.form.salaryType}>
            <Select value={form.salaryType} onChange={v=>setForm(p=>({...p,salaryType:v}))}>
              {tc.form.salaryTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label={tc.form.salaryValue}><Input value={form.salaryValue} onChange={v=>setForm(p=>({...p,salaryValue:v}))} placeholder="30"/></FormField>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0" }}>
          <input
            type="checkbox"
            id="createLogin"
            checked={form.createLogin}
            onChange={e => setForm(p => ({ ...p, createLogin: e.target.checked }))}
            style={{ width:14, height:14, cursor:"pointer" }}
          />
          <label htmlFor="createLogin" style={{ fontSize:12, color:"var(--color-text-primary)", cursor:"pointer" }}>
            {lang==="en" ? "Create login account for teacher" : "O'qituvchi uchun login yaratish"}
          </label>
        </div>
        {form.createLogin && (
          <FormField label={lang==="en" ? "PASSWORD" : "PAROL"}>
            <Input
              value={form.password}
              onChange={v => setForm(p => ({ ...p, password: v }))}
              placeholder="teacher123"
            />
          </FormField>
        )}
        <ModalButtons>
          <Button variant="ghost" onClick={()=>setModal(false)}>{tc.form.cancel}</Button>
          <Button onClick={handleSave} style={{ opacity:saving?.6:1 }}>{saving?"...":tc.form.save}</Button>
        </ModalButtons>
      </Modal>
    </div>
  );
}
