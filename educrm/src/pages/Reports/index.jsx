import { useState } from "react";
import { useLang } from "../../i18n/LangContext";
import { usePermissions } from "../../auth/permissions";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../api/useApi";
import { api } from "../../api/client";
import { KpiCard, NoAccess } from "../../components/ui";

// ── PDF generator (pure JS, no library needed) ────────────────
function generatePDF(title, headers, rows, filename) {
  // Build simple HTML → print as PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a18; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #04342C; }
    .logo { font-size: 20px; font-weight: 700; color: #04342C; }
    .meta { font-size: 11px; color: #666; text-align: right; }
    h2 { font-size: 15px; color: #04342C; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: #04342C; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
    tbody tr:nth-child(even) { background: #f5f5f3; }
    tbody td { padding: 7px 10px; border-bottom: 0.5px solid #ddd; font-size: 11px; }
    .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">EduCRM</div>
    <div class="meta">
      <div>${title}</div>
      <div>${new Date().toLocaleDateString("uz-UZ")}</div>
    </div>
  </div>
  <h2>${title}</h2>
  <table>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell ?? "—"}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  <div class="footer">EduCRM · ${new Date().getFullYear()}</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── Excel (CSV) generator ──────────────────────────────────────
function downloadCSV(headers, rows, filename) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const lines = [
    headers.join(";"),
    ...rows.map(row => row.map(cell => `"${String(cell??"")}"`).join(";")),
  ];
  const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ────────────────────────────────────────────────────
function fmt(n) { return Number(n||0).toLocaleString(); }
function Skeleton({ h=40, r=8 }) {
  return <div style={{ height:h, borderRadius:r, background:"var(--color-background-secondary)", animation:"pulse 1.4s ease-in-out infinite" }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </div>;
}
function Card({ children, style }) {
  return <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:14, ...style }}>{children}</div>;
}
function ReportBtn({ onClick, icon, label, color="#1D9E75" }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:6, padding:"7px 14px",
      borderRadius:8, border:`0.5px solid ${color}33`, background:`${color}11`,
      color, cursor:"pointer", fontSize:12, fontFamily:"var(--font-sans)", transition:"all .12s",
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background=`${color}22`; }}
    onMouseLeave={e=>{ e.currentTarget.style.background=`${color}11`; }}>
      {icon} {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Reports() {
  const { lang } = useLang();
  const isUz = lang !== "en";
  const { branchId, isSuperAdmin } = useAuth();
  const now   = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [tab,   setTab]   = useState("payments"); // payments | attendance | summary

  const P = usePermissions();
  if (P.reports.noAccess) return <NoAccess message={isUz ? "Hisobotlar bo'limine ruxsatingiz yo'q" : "No access to reports"} hint={isUz ? "O'qituvchilar hisobot ko'ra olmaydi" : "Teachers cannot view reports"}/>;
  const bid = isSuperAdmin ? undefined : branchId;

  // ── Fetch data ─────────────────────────────────────────────
  const { data: payData, loading: payLoading } = useApi(
    () => api.payments.list({ branch_id: bid, period_month: month, period_year: year, limit: 200 }),
    [bid, month, year]
  );
  const payments = payData?.data ?? [];

  const { data: debtData, loading: debtLoading } = useApi(
    () => api.payments.debtors({ branch_id: bid }),
    [bid]
  );
  const debtors = debtData?.data ?? [];

  const { data: groupsData } = useApi(
    () => api.groups.list({ branch_id: bid }),
    [bid]
  );
  const groups = groupsData ?? [];

  // ── Computed ───────────────────────────────────────────────
  const totalPaid    = payments.filter(p=>p.status==="paid").reduce((a,p)=>a+Number(p.amount),0);
  const totalDebt    = payments.filter(p=>p.status==="debt").reduce((a,p)=>a+Number(p.amount),0);
  const paidCount    = payments.filter(p=>p.status==="paid").length;
  const debtCount    = payments.filter(p=>p.status==="debt").length;
  const pendCount    = payments.filter(p=>p.status==="pending").length;

  // Months for select
  const monthNames = isUz
    ? ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"]
    : ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // ── Export functions ───────────────────────────────────────
  function exportPaymentsPDF() {
    const title   = isUz ? `To'lovlar hisoboti — ${monthNames[month-1]} ${year}` : `Payments Report — ${monthNames[month-1]} ${year}`;
    const headers = isUz ? ["Talaba","Guruh","Summa","To'lov turi","Holat","Sana"] : ["Student","Group","Amount","Method","Status","Date"];
    const rows    = payments.map(p => [
      p.student_name ?? `#${p.student_id}`,
      `${p.period_month}/${p.period_year}`,
      `${fmt(p.amount)} so'm`,
      p.method, p.status,
      p.created_at?.slice(0,10),
    ]);
    generatePDF(title, headers, rows, `payments_${month}_${year}`);
  }

  function exportPaymentsExcel() {
    const headers = isUz ? ["Talaba","Guruh","Summa","To'lov turi","Holat","Chek raqami","Sana"] : ["Student","Group","Amount","Method","Status","Receipt","Date"];
    const rows    = payments.map(p => [
      p.student_name ?? `#${p.student_id}`,
      `${p.period_month}/${p.period_year}`,
      Number(p.amount),
      p.method, p.status,
      p.receipt_no,
      p.created_at?.slice(0,10),
    ]);
    downloadCSV(headers, rows, `tolovlar_${month}_${year}`);
  }

  function exportDebtorsPDF() {
    const title   = "Qarzdorlar ro'yxati";
    const headers = ["Talaba","Guruh","Summa","Oy"];
    const rows    = debtors.map(p => [
      p.student_name ?? `#${p.student_id}`,
      p.group_id ? `Guruh #${p.group_id}` : "—",
      `${fmt(p.amount)} so'm`,
      `${p.period_month}/${p.period_year}`,
    ]);
    generatePDF(title, headers, rows, "qarzdorlar");
  }

  function exportDebtorsExcel() {
    const headers = ["Talaba","Guruh ID","Summa","Oy","Yil","Chek"];
    const rows    = debtors.map(p => [
      p.student_name ?? `#${p.student_id}`,
      p.group_id ?? "—",
      Number(p.amount),
      p.period_month, p.period_year,
      p.receipt_no,
    ]);
    downloadCSV(headers, rows, "qarzdorlar");
  }

  function exportSummaryPDF() {
    const title   = `Oylik xulosa — ${monthNames[month-1]} ${year}`;
    const headers = ["Ko'rsatkich","Qiymat"];
    const rows    = [
      ["Jami to'lovlar", payments.length],
      ["To'langan",      `${paidCount} ta — ${fmt(totalPaid)} so'm`],
      ["Qarzdor",        `${debtCount} ta — ${fmt(totalDebt)} so'm`],
      ["Kutilmoqda",     `${pendCount} ta`],
      ["Aktiv guruhlar", groups.length],
      ["Umumiy qarzdorlar", debtors.length],
    ];
    generatePDF(title, headers, rows, `xulosa_${month}_${year}`);
  }

  const TABS = [
    { key:"payments",   label: isUz ? "To'lovlar"    : "Payments" },
    { key:"debtors",    label: isUz ? "Qarzdorlar"   : "Debtors" },
    { key:"summary",    label: isUz ? "Oylik xulosa" : "Monthly summary" },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{isUz ? "Hisobotlar" : "Reports"}</span>
        <div style={{ display:"flex", gap:6, marginLeft:"auto", alignItems:"center" }}>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"5px 10px", fontSize:12, background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", outline:"none" }}>
            {monthNames.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"5px 10px", fontSize:12, background:"var(--color-background-primary)", color:"var(--color-text-primary)", fontFamily:"var(--font-sans)", outline:"none" }}>
            {[2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)", display:"flex", flexDirection:"column", gap:12 }}>

        {/* KPI summary */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {payLoading ? Array(4).fill(0).map((_,i)=><Skeleton key={i} h={72} r={10}/>) : <>
            <KpiCard label={isUz?"Jami to'lovlar":"Total payments"} value={payments.length}/>
            <KpiCard label={isUz?"To'langan":"Paid"}    value={paidCount}  sub={`${fmt(totalPaid)} ${isUz?"so'm":"UZS"}`} subColor="#1D9E75"/>
            <KpiCard label={isUz?"Qarzdorlar":"Debtors"} value={debtCount} sub={`${fmt(totalDebt)} ${isUz?"so'm":"UZS"}`} subColor="#A32D2D"/>
            <KpiCard label={isUz?"Kutilmoqda":"Pending"} value={pendCount}/>
          </>}
        </div>

        {/* Tab selector */}
        <div style={{ display:"flex", gap:6 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{ padding:"6px 14px", borderRadius:8, fontSize:12, cursor:"pointer", fontFamily:"var(--font-sans)", transition:"all .12s",
                border: tab===t.key ? "0.5px solid #1D9E75" : "0.5px solid var(--color-border-tertiary)",
                background: tab===t.key ? "#E1F5EE" : "var(--color-background-primary)",
                color: tab===t.key ? "#0F6E56" : "var(--color-text-secondary)",
                fontWeight: tab===t.key ? 500 : 400,
              }}>{t.label}</button>
          ))}
        </div>

        {/* ── TO'LOVLAR TAB ─────────────────────────────────── */}
        {tab === "payments" && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:500 }}>
                {isUz?"To'lovlar":"Payments"} — {monthNames[month-1]} {year}
                <span style={{ fontWeight:400, color:"var(--color-text-secondary)", marginLeft:8 }}>({payments.length}{isUz?" ta":""})</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <ReportBtn onClick={exportPaymentsPDF}   icon="🖨" label={isUz?"PDF chop etish":"Print PDF"}/>
                <ReportBtn onClick={exportPaymentsExcel} icon="📊" label={isUz?"Excel yuklab olish":"Download Excel"} color="#185FA5"/>
              </div>
            </div>
            {payLoading ? <Skeleton h={200}/> : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr>{(isUz?["Talaba","Oy","Summa","Turi","Holat","Chek"]:["Student","Month","Amount","Type","Status","Receipt"]).map(h=>(
                      <th key={h} style={{ textAlign:"left", padding:"7px 11px", fontSize:10, color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {payments.length ? payments.map((p,i) => (
                      <tr key={p.id} style={{ borderBottom: i<payments.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{ padding:"7px 11px", fontWeight:500 }}>{p.student_name??`#${p.student_id}`}</td>
                        <td style={{ padding:"7px 11px", color:"var(--color-text-secondary)" }}>{p.period_month}/{p.period_year}</td>
                        <td style={{ padding:"7px 11px", fontWeight:500 }}>{fmt(p.amount)} so'm</td>
                        <td style={{ padding:"7px 11px" }}>
                          <span style={{ background:{ cash:"var(--color-background-secondary)", card:"#E6F1FB", payme:"#EEEDFE", click:"#FAEEDA" }[p.method]||"var(--color-background-secondary)", color:{ cash:"var(--color-text-secondary)", card:"#0C447C", payme:"#3C3489", click:"#633806" }[p.method]||"var(--color-text-secondary)", padding:"2px 7px", borderRadius:10, fontSize:10 }}>
                            {p.method}
                          </span>
                        </td>
                        <td style={{ padding:"7px 11px" }}>
                          <span style={{ background:{ paid:"#E1F5EE", debt:"#FCEBEB", pending:"#FAEEDA" }[p.status], color:{ paid:"#085041", debt:"#791F1F", pending:"#633806" }[p.status], padding:"2px 7px", borderRadius:10, fontSize:10, fontWeight:500 }}>
                            {{ paid:"To'langan", debt:"Qarzdor", pending:"Kutilmoqda" }[p.status]||p.status}
                          </span>
                        </td>
                        <td style={{ padding:"7px 11px", color:"var(--color-text-secondary)", fontSize:11 }}>{p.receipt_no}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} style={{ textAlign:"center", padding:24, color:"var(--color-text-secondary)", fontSize:12 }}>
                        Bu oy uchun to'lov ma'lumoti yo'q
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── QARZDORLAR TAB ────────────────────────────────── */}
        {tab === "debtors" && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:500 }}>
                Qarzdorlar ro'yxati
                <span style={{ fontWeight:400, color:"#A32D2D", marginLeft:8 }}>({debtors.length} ta)</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <ReportBtn onClick={exportDebtorsPDF}   icon="🖨" label="PDF chop etish"/>
                <ReportBtn onClick={exportDebtorsExcel} icon="📊" label="Excel yuklab olish" color="#185FA5"/>
              </div>
            </div>
            {debtLoading ? <Skeleton h={200}/> : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr>{["Talaba","Summa","Oy / Yil","Chek"].map(h=>(
                    <th key={h} style={{ textAlign:"left", padding:"7px 11px", fontSize:10, color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", background:"var(--color-background-secondary)" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {debtors.length ? debtors.map((p,i) => (
                    <tr key={p.id} style={{ borderBottom: i<debtors.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--color-background-secondary)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{ padding:"7px 11px", fontWeight:500 }}>{p.student_name??`#${p.student_id}`}</td>
                      <td style={{ padding:"7px 11px", fontWeight:500, color:"#A32D2D" }}>{fmt(p.amount)} so'm</td>
                      <td style={{ padding:"7px 11px", color:"var(--color-text-secondary)" }}>{p.period_month}/{p.period_year}</td>
                      <td style={{ padding:"7px 11px", color:"var(--color-text-secondary)", fontSize:11 }}>{p.receipt_no}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign:"center", padding:24, color:"#1D9E75", fontSize:12 }}>
                      🎉 Hozirda qarzdor yo'q!
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
            {debtors.length > 0 && (
              <div style={{ marginTop:12, padding:"10px 12px", background:"#FCEBEB", borderRadius:8, fontSize:12, color:"#791F1F", display:"flex", justifyContent:"space-between" }}>
                <span>Jami qarz:</span>
                <span style={{ fontWeight:500 }}>{fmt(debtors.reduce((a,p)=>a+Number(p.amount),0))} so'm</span>
              </div>
            )}
          </Card>
        )}

        {/* ── XULOSA TAB ────────────────────────────────────── */}
        {tab === "summary" && (
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:500 }}>Oylik xulosa — {monthNames[month-1]} {year}</div>
              <ReportBtn onClick={exportSummaryPDF} icon="🖨" label="PDF chop etish"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Jami to'lovlar",    val:payments.length,          color:"var(--color-text-primary)" },
                { label:"To'langan",          val:`${paidCount} ta`,        color:"#1D9E75",  sub:`${fmt(totalPaid)} so'm` },
                { label:"Qarzdorlar",         val:`${debtCount} ta`,        color:"#A32D2D",  sub:`${fmt(totalDebt)} so'm` },
                { label:"Kutilmoqda",         val:`${pendCount} ta`,        color:"#BA7517" },
                { label:"Aktiv guruhlar",     val:groups.length,            color:"var(--color-text-primary)" },
                { label:"Umumiy qarzdorlar",  val:debtors.length,           color:"#A32D2D" },
              ].map(item => (
                <div key={item.label} style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"12px 14px", display:"flex", flexDirection:"column", gap:4 }}>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{item.label}</div>
                  <div style={{ fontSize:20, fontWeight:500, color:item.color }}>{item.val}</div>
                  {item.sub && <div style={{ fontSize:11, color:item.color }}>{item.sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginTop:14, padding:"12px 14px", background:"#E1F5EE", borderRadius:8 }}>
              <div style={{ fontSize:11, color:"#085041", marginBottom:4 }}>To'lov konversiyasi</div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ flex:1, height:8, background:"var(--color-border-tertiary)", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width: payments.length ? `${Math.round(paidCount/payments.length*100)}%` : "0%", background:"#1D9E75", borderRadius:4, transition:"width .3s" }}/>
                </div>
                <span style={{ fontSize:13, fontWeight:500, color:"#085041" }}>
                  {payments.length ? Math.round(paidCount/payments.length*100) : 0}%
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
