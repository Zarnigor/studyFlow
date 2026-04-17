import { useState, useEffect } from "react";
import { api } from "./api/client";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { usePermissions } from "./auth/permissions";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LangProvider, useLang } from "./i18n/LangContext";
import Dashboard   from "./pages/Dashboard";
import Students    from "./pages/Students";
import Payments    from "./pages/Payments";
import Teachers    from "./pages/Teachers";
import Leads       from "./pages/Leads";
import Groups      from "./pages/Groups";
import Lessons     from "./pages/Lessons";
import Reports     from "./pages/Reports";
import Settings    from "./pages/Settings";
import AttendancePage from "./pages/Attendance";

import Users      from "./pages/Users";
import { NoAccess, ComingSoon } from "./components/ui";

const ALL_NAV = [
  { key:"dashboard",  dot:"#9FE1CB", section:"main" },
  { key:"students",   dot:"#378ADD", section:"main" },
  { key:"groups",     dot:"#7F77DD", section:"main" },
  { key:"payments",   dot:"#BA7517", section:"main", badge:"debtors" },
  { key:"attendance", dot:"#639922", section:"main" },
  { key:"teachers",   dot:"#D4537E", section:"other" },
  { key:"leads",      dot:"#85B7EB", section:"other", badge:"newLeads" },
  { key:"users",      dot:"#378ADD", section:"other" },
  { key:"reports",    dot:"#888780", section:"other" },
  { key:"settings",   dot:"#5DCAA5", section:"other" },
];

const NAV_LABELS = {
  uz: { dashboard:"Dashboard", students:"Talabalar", groups:"Guruhlar",
        lessons:"Darslar", payments:"To'lovlar", attendance:"Yo'qlama",
        teachers:"O'qituvchilar", leads:"Arizalar", reports:"Hisobotlar",
        settings:"Sozlamalar", users:"Foydalanuvchilar" },
  en: { dashboard:"Dashboard", students:"Students", groups:"Groups",
        lessons:"Lessons", payments:"Payments", attendance:"Roll Call",
        teachers:"Teachers", leads:"Leads", reports:"Reports",
        settings:"Settings", users:"Users" },
};

function UserBadge({ onLogout }) {
  const { user } = useAuth();
  if (!user) return null;
  const ini = user.full_name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const roleColor = {
    super_admin:"#1D9E75", admin:"#378ADD",
    manager:"#7F77DD", teacher:"#D4537E", cashier:"#BA7517"
  }[user.role]??"#888780";
  const roleLabel = {
    super_admin:"Super Admin", admin:"Admin", manager:"Menejer",
    teacher:"O'qituvchi", cashier:"Kassir"
  }[user.role]??user.role;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
      <div style={{ width:30, height:30, borderRadius:"50%", background:roleColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:500, color:"#fff", flexShrink:0 }}>{ini}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,.75)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.full_name}</div>
        <div style={{ fontSize:9, color:"rgba(255,255,255,.35)", display:"flex", alignItems:"center", gap:4 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:roleColor }}/>
          {roleLabel}
        </div>
      </div>
      <button onClick={onLogout} title="Chiqish"
        style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"rgba(255,255,255,.3)", fontSize:14, lineHeight:1, transition:"color .12s" }}
        onMouseEnter={e=>e.currentTarget.style.color="#F09595"}
        onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.3)"}>⏻</button>
    </div>
  );
}

function Sidebar({ activeTab, onTabChange, badges, onLogout, open, onClose }) {
  const { lang, setLang, t } = useLang();
  const P = usePermissions();
  const labels = NAV_LABELS[lang]??NAV_LABELS.uz;

  // Faqat ruxsat berilgan nav itemlarni ko'rsatish
  const visibleNav = ALL_NAV.filter(item => P.nav[item.key] !== false);

  return (
    <aside className={`sidebar${open ? " sidebar-open" : ""}`} style={{ width:204, background:"#04342C", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"18px 16px 14px", borderBottom:"0.5px solid rgba(255,255,255,.07)", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div>
          <div style={{ color:"#9FE1CB", fontSize:15, fontWeight:500 }}>{t.appName}</div>
          <div style={{ color:"rgba(255,255,255,.25)", fontSize:10, marginTop:2 }}>{t.appTag}</div>
        </div>
        <button onClick={onClose} className="sidebar-close"
          style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.4)", fontSize:20, lineHeight:1, padding:"0 2px", alignItems:"center", justifyContent:"center" }}>
          ×
        </button>
      </div>

      {["main","other"].map(section=>(
        <div key={section}>
          {visibleNav.some(n=>n.section===section) && (
            <div style={{ padding:"14px 16px 4px", color:"rgba(255,255,255,.18)", fontSize:9, letterSpacing:".1em", textTransform:"uppercase" }}>
              {lang==="en"?section.toUpperCase():section==="main"?"ASOSIY":"BOSHQA"}
            </div>
          )}
          {visibleNav.filter(n=>n.section===section).map(item=>{
            const isAct = activeTab===item.key;
            const badge = item.badge ? badges[item.badge] : null;
            return (
              <div key={item.key} onClick={()=>onTabChange(item.key)}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 16px", cursor:"pointer", fontSize:12, userSelect:"none",
                  color:isAct?"#9FE1CB":"rgba(255,255,255,.45)",
                  background:isAct?"rgba(29,158,117,.18)":"transparent",
                  borderRight:isAct?"2px solid #1D9E75":"2px solid transparent",
                  transition:"all .12s" }}
                onMouseEnter={e=>{ if(!isAct){e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.color="rgba(255,255,255,.8)";} }}
                onMouseLeave={e=>{ if(!isAct){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,.45)";} }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:item.dot, flexShrink:0 }}/>
                <span style={{ flex:1 }}>{labels[item.key]??item.key}</span>
                {badge>0 && (
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", minWidth:17, height:17, borderRadius:10, background:"rgba(162,45,45,.7)", color:"#fff", fontSize:9, padding:"0 4px" }}>{badge}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop:"auto", padding:"12px 16px", borderTop:"0.5px solid rgba(255,255,255,.06)" }}>
        <UserBadge onLogout={onLogout}/>
        <div style={{ display:"flex", background:"rgba(255,255,255,.07)", borderRadius:6, overflow:"hidden" }}>
          {["uz","en"].map(l=>(
            <div key={l} onClick={()=>setLang(l)} style={{ flex:1, padding:"5px 0", textAlign:"center", fontSize:11, cursor:"pointer", background:lang===l?"#1D9E75":"transparent", color:lang===l?"#fff":"rgba(255,255,255,.35)", transition:"all .12s" }}>{l.toUpperCase()}</div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function AppShell() {
  const { lang } = useLang();
  const { logout } = useAuth();
  const P = usePermissions();
  const [tab,         setTab]         = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const labels = NAV_LABELS[lang]??NAV_LABELS.uz;

  // Agar sahifaga ruxsat yo'q bo'lsa, NoAccess qaytaradi (har bir sahifada o'zi tekshiradi)
  const renderPage = () => {
    switch(tab) {
      case "dashboard":  return <Dashboard/>;
      case "students":   return <Students/>;
      case "groups":     return <Groups/>;
      case "lessons":    return <Lessons/>;
      case "payments":   return <Payments/>;
      case "attendance": return <AttendancePage/>;
      case "teachers":   return <Teachers/>;
      case "leads":      return <Leads/>;
      case "reports":    return <Reports/>;
      case "settings":   return <Settings/>;
      case "users":      return <Users/>;
      default:
        return (
          <div style={{ flex:1, display:"flex", flexDirection:"column", background:"var(--color-background-tertiary)" }}>
            <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)" }}>
              <span style={{ fontSize:14, fontWeight:500 }}>{labels[tab]??tab}</span>
            </div>
            <ComingSoon message="Tez orada..."/>
          </div>
        );
    }
  };

  const [badges, setBadges] = useState({ debtors: 0, newLeads: 0 });

  useEffect(() => {
    async function loadBadges() {
      try {
        const [paymentsRes, leadsRes] = await Promise.all([
          api.payments.list({ status: "debt", limit: 1 }),
          api.leads.list({ stage: "new", limit: 1 }),
        ]);
        setBadges({
          debtors:  paymentsRes?.meta?.total ?? 0,
          newLeads: leadsRes?.meta?.total    ?? 0,
        });
      } catch(e) {
        console.warn("Badges load failed:", e.message);
      }
    }
    loadBadges();
    const interval = setInterval(loadBadges, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display:"flex", height:"100dvh", fontFamily:"var(--font-sans,system-ui,sans-serif)", fontSize:13, overflow:"hidden", position:"relative" }}>

      {/* Mobile overlay — shown when sidebar is open on mobile */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`mobile-overlay${sidebarOpen ? " overlay-visible" : ""}`}
      />

      <Sidebar
        activeTab={tab}
        onTabChange={t => { setTab(t); setSidebarOpen(false); }}
        badges={badges}
        onLogout={logout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content column */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>

        {/* Mobile topbar with hamburger */}
        <div className="mobile-topbar" style={{
          padding:"10px 14px",
          background:"var(--color-background-primary)",
          borderBottom:"0.5px solid var(--color-border-tertiary)",
          alignItems:"center", gap:10, flexShrink:0,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:4, color:"var(--color-text-primary)", display:"flex", alignItems:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span style={{ fontSize:15, fontWeight:500, color:"#1D9E75" }}>StudyFlow</span>
        </div>

        {renderPage()}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <ProtectedRoute>
          <AppShell/>
        </ProtectedRoute>
      </LangProvider>
    </AuthProvider>
  );
}
