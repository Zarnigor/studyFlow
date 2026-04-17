import { useState, useEffect } from "react";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import { NoAccess, FormField, Input, Button, ModalButtons } from "../../components/ui";

function Section({ title, children }) {
  return (
    <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, overflow:"hidden", marginBottom:14 }}>
      <div style={{ padding:"10px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)" }}>
        <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{title}</span>
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start", marginBottom:16, paddingBottom:16, borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
      <div>
        <div style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)", marginBottom:3 }}>{label}</div>
        {hint && <div style={{ fontSize:11, color:"var(--color-text-secondary)", lineHeight:1.5 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SaveBtn({ loading, saved, onClick, label="Saqlash" }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
      <button onClick={onClick} disabled={loading}
        style={{ background:loading?"#5DCAA5":"#1D9E75", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, cursor:loading?"default":"pointer", fontFamily:"var(--font-sans)", transition:"background .12s" }}>
        {loading ? "Saqlanmoqda..." : label}
      </button>
      {saved && <span style={{ fontSize:12, color:"#1D9E75", fontWeight:500 }}>✅ Saqlandi!</span>}
    </div>
  );
}

const ROLE_LABELS = { super_admin:"Super Admin", admin:"Admin", manager:"Menejer", teacher:"O'qituvchi", cashier:"Kassir" };
const ROLE_COLORS = { super_admin:"#E1F5EE|#085041", admin:"#E6F1FB|#0C447C", manager:"#EEEDFE|#3C3489", teacher:"#FBEAF0|#72243E", cashier:"#FAEEDA|#633806" };

export default function Settings() {
  const { lang, setLang } = useLang();
  const { user } = useAuth();
  const P = usePermissions();

  if (P.settings.noAccess) {
    return <NoAccess message="Sozlamalarga ruxsatingiz yo'q" hint="Faqat admin va super admin sozlamalarni boshqara oladi"/>;
  }
  // Subjects state
  const [subjects,   setSubjects]   = useState([]);
  const [newSubject, setNewSubject] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subSaved,   setSubSaved]   = useState(false);

  async function loadSubjects() {
    try {
      const res = await api.subjects.list();
      setSubjects(Array.isArray(res) ? res : res?.data ?? []);
    } catch(e) { console.error(e); }
  }

  useEffect(() => { loadSubjects(); }, []);

  async function handleAddSubject() {
    if (!newSubject.trim()) return;
    setSubLoading(true);
    try {
      await api.subjects.create({ name: newSubject.trim() });
      setNewSubject("");
      setSubSaved(true);
      await loadSubjects();
      setTimeout(() => setSubSaved(false), 2000);
    } catch(e) {
      alert(e.message ?? (isUz ? "Xatolik yuz berdi" : "Error occurred"));
    } finally {
      setSubLoading(false);
    }
  }

  // Password change state
  const [pwForm,   setPwForm]   = useState({ current:"", next:"", confirm:"" });
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState("");
  const [pwLoading,setPwLoading]= useState(false);

  // Profile state
  const [profForm, setProfForm] = useState({ full_name: user?.full_name ?? "", phone: user?.phone ?? "" });
  const [profSaved,setProfSaved]= useState(false);
  const [profLoad, setProfLoad] = useState(false);

  const isUz = lang !== "en";

  const T = {
    title:        isUz ? "Sozlamalar" : "Settings",
    profile:      isUz ? "Profil" : "Profile",
    security:     isUz ? "Xavfsizlik" : "Security",
    appearance:   isUz ? "Ko'rinish" : "Appearance",
    about:        isUz ? "Tizim haqida" : "About",
    fullName:     isUz ? "Ism Familiya" : "Full Name",
    fullNameHint: isUz ? "Tizimda ko'rinadigan ism" : "Name shown in the system",
    phone:        isUz ? "Telefon" : "Phone",
    phoneHint:    isUz ? "Login uchun telefon" : "Phone used for login",
    role:         isUz ? "Rol" : "Role",
    roleHint:     isUz ? "Rolni faqat super admin o'zgartira oladi" : "Only super admin can change roles",
    branch:       isUz ? "Filial" : "Branch",
    branchHint:   isUz ? "Siz ishlayotgan filial" : "Your assigned branch",
    curPw:        isUz ? "Joriy parol" : "Current password",
    newPw:        isUz ? "Yangi parol" : "New password",
    confirmPw:    isUz ? "Parolni tasdiqlang" : "Confirm password",
    curPwHint:    isUz ? "Hozirgi parolingizni kiriting" : "Enter your current password",
    newPwHint:    isUz ? "Kamida 8 ta belgi" : "Minimum 8 characters",
    langLabel:    isUz ? "Interfeys tili" : "Interface language",
    langHint:     isUz ? "Barcha sahifalar shu tilda ko'rsatiladi" : "All pages shown in this language",
    version:      isUz ? "Versiya" : "Version",
    versionVal:   "StudyFlow v1.0.0",
    developer:    isUz ? "Ishlab chiquvchi" : "Developer",
    support:      isUz ? "Qo'llab-quvvatlash" : "Support",
    pwMismatch:   isUz ? "Yangi parollar mos kelmadi" : "Passwords do not match",
    pwShort:      isUz ? "Parol kamida 8 ta belgidan iborat bo'lishi kerak" : "Password must be at least 8 characters",
    pwWrong:      isUz ? "Joriy parol noto'g'ri" : "Current password is incorrect",
    changePw:     isUz ? "Parolni o'zgartirish" : "Change Password",
    saveProfile:  isUz ? "Saqlash" : "Save",
  };

  async function handleChangePassword() {
    setPwError("");
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return;
    if (pwForm.next.length < 8) { setPwError(T.pwShort); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError(T.pwMismatch); return; }

    setPwLoading(true);
    try {
      // Re-login to verify current password
      await api.auth.login(user.phone, pwForm.current);
      // Change password via user update endpoint
      await api.users.changePassword(user.id, pwForm.next);
      setPwSaved(true);
      setPwForm({ current:"", next:"", confirm:"" });
      setTimeout(() => setPwSaved(false), 3000);
    } catch(e) {
      setPwError(e.status === 401 ? T.pwWrong : (e.message ?? "Xatolik"));
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!profForm.full_name) return;
    setProfLoad(true);
    try {
      await api.users.update(user.id, { full_name: profForm.full_name });
      setProfSaved(true);
      setTimeout(() => setProfSaved(false), 3000);
    } catch(e) {
      alert(e.message);
    } finally {
      setProfLoad(false);
    }
  }

  const [bg, tc] = (ROLE_COLORS[user?.role] ?? "var(--color-background-secondary)|var(--color-text-secondary)").split("|");

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{T.title}</span>
        <div style={{ display:"flex", background:"rgba(0,0,0,.06)", borderRadius:8, overflow:"hidden", marginLeft:"auto" }}>
          {["uz","en"].map(l => (
            <button key={l} onClick={()=>setLang(l)}
              style={{ padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border:"none", background:lang===l?"#1D9E75":"transparent", color:lang===l?"#fff":"var(--color-text-secondary)", transition:"all .12s" }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:"16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>
        <div style={{ maxWidth:680 }}>

          {/* ── PROFILE ── */}
          <Section title={T.profile}>
            <Row label={T.fullName} hint={T.fullNameHint}>
              <Input value={profForm.full_name} onChange={v=>setProfForm(p=>({...p,full_name:v}))} placeholder="Ism Familiya"/>
              <SaveBtn loading={profLoad} saved={profSaved} onClick={handleSaveProfile} label={T.saveProfile}/>
            </Row>
            <Row label={T.phone} hint={T.phoneHint}>
              <div style={{ padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:8, fontSize:12, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)" }}>
                {user?.phone ?? "—"}
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:5 }}>
                {isUz ? "Telefonni faqat admin o'zgartira oladi" : "Contact admin to change phone"}
              </div>
            </Row>
            <Row label={T.role} hint={T.roleHint}>
              <span style={{ display:"inline-flex", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:500, background:bg, color:tc }}>
                {ROLE_LABELS[user?.role] ?? user?.role}
              </span>
            </Row>
            {user?.branch_id && (
              <Row label={T.branch} hint={T.branchHint}>
                <span style={{ fontSize:13, fontWeight:500, color:"var(--color-text-primary)" }}>
                  Filial #{user.branch_id}
                </span>
              </Row>
            )}
          </Section>

          {/* ── SECURITY ── */}
          <Section title={T.security}>
            <Row label={T.curPw} hint={T.curPwHint}>
              <input type="password" value={pwForm.current} placeholder="••••••••"
                onChange={e=>setPwForm(p=>({...p,current:e.target.value}))}
                style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
            </Row>
            <Row label={T.newPw} hint={T.newPwHint}>
              <input type="password" value={pwForm.next} placeholder="••••••••"
                onChange={e=>setPwForm(p=>({...p,next:e.target.value}))}
                style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
            </Row>
            <Row label={T.confirmPw} hint="">
              <input type="password" value={pwForm.confirm} placeholder="••••••••"
                onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))}
                style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%" }}/>
              {pwError && (
                <div style={{ marginTop:6, padding:"6px 10px", background:"#FCEBEB", borderRadius:7, fontSize:11, color:"#791F1F" }}>{pwError}</div>
              )}
              <SaveBtn loading={pwLoading} saved={pwSaved} onClick={handleChangePassword} label={T.changePw}/>
            </Row>
          </Section>

          {/* ── APPEARANCE ── */}
          <Section title={T.appearance}>
            <Row label={T.langLabel} hint={T.langHint}>
              <div style={{ display:"flex", gap:8 }}>
                {["uz","en"].map(l => (
                  <button key={l} onClick={()=>setLang(l)}
                    style={{ padding:"7px 20px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"var(--font-sans)", transition:"all .12s",
                      border:lang===l?"0.5px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",
                      background:lang===l?"#E1F5EE":"var(--color-background-primary)",
                      color:lang===l?"#0F6E56":"var(--color-text-secondary)",
                      fontWeight:lang===l?500:400,
                    }}>
                    {l === "uz" ? "🇺🇿 O'zbek" : "🇬🇧 English"}
                  </button>
                ))}
              </div>
            </Row>
          </Section>

          {/* ── SUBJECTS ── */}
          <Section title={isUz ? "Fanlar" : "Subjects"}>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:"var(--color-text-secondary)", marginBottom:8 }}>
                {isUz
                  ? "Guruh yaratishda ko'rsatiladigan fanlar ro'yxati"
                  : "Subjects shown when creating groups"}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                {subjects.map(s => (
                  <span key={s.id} style={{
                    background:"var(--color-background-secondary)",
                    border:"0.5px solid var(--color-border-tertiary)",
                    borderRadius:8, padding:"4px 10px", fontSize:12,
                    color:"var(--color-text-primary)",
                    display:"flex", alignItems:"center", gap:5,
                  }}>
                    {s.name}
                  </span>
                ))}
                {subjects.length === 0 && (
                  <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>
                    {isUz ? "Fan qo'shilmagan" : "No subjects added"}
                  </span>
                )}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddSubject(); }}
                  placeholder={isUz ? "Fan nomi (masalan: English, IELTS...)" : "Subject name (e.g. English, IELTS...)"}
                  style={{
                    flex:1, border:"0.5px solid var(--color-border-secondary)",
                    borderRadius:8, padding:"7px 10px", fontSize:12,
                    color:"var(--color-text-primary)",
                    background:"var(--color-background-primary)",
                    fontFamily:"var(--font-sans)", outline:"none",
                  }}
                />
                <button
                  onClick={handleAddSubject}
                  disabled={subLoading || !newSubject.trim()}
                  style={{
                    padding:"7px 16px", borderRadius:8, fontSize:12,
                    background: subLoading || !newSubject.trim() ? "#5DCAA5" : "#1D9E75",
                    color:"#fff", border:"none", cursor: subLoading || !newSubject.trim() ? "default" : "pointer",
                    fontFamily:"var(--font-sans)", whiteSpace:"nowrap",
                  }}>
                  {subLoading ? "..." : (isUz ? "+ Qo'shish" : "+ Add")}
                </button>
                {subSaved && (
                  <span style={{ fontSize:12, color:"#1D9E75", fontWeight:500 }}>✅</span>
                )}
              </div>
            </div>
          </Section>

          {/* ── ABOUT ── */}
          <Section title={T.about}>
            {[
              [T.version,   T.versionVal],
              [T.developer, "StudyFlow Team"],
            ].map(([label, val]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
                <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{label}</span>
                <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{val}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize:12, color:"var(--color-text-secondary)" }}>{T.support}</span>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                <a href="https://t.me/mercurial1255" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize:12, fontWeight:500, color:"#2AABEE", textDecoration:"none" }}>
                  Telegram: @mercurial1255
                </a>
                <a href="mailto:mercurial1255@gmail.com"
                  style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)", textDecoration:"none" }}>
                  mercurial1255@gmail.com
                </a>
              </div>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
