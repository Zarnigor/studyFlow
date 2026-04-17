import { useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { useApi } from "../../api/useApi";
import { api } from "../../api/client";
import { Avatar, Badge, KpiCard, ProgressBar } from "../../components/ui";

const PIE_COLORS = ["#1D9E75","#378ADD","#BA7517","#7F77DD","#639922"];
const BRANCH_LABELS = { all:"Barchasi", 1:"Filial 1", 2:"Filial 2", 3:"Filial 3" };

function fmt(n) {
  if (!n) return "0";
  n = Number(n);
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1)+"M";
  if (n >= 1_000)     return (n/1_000).toFixed(0)+"K";
  return n.toLocaleString();
}
function Skeleton({ h=20, r=6, style={} }) {
  return <div style={{ height:h, borderRadius:r, background:"var(--color-background-secondary)", animation:"pulse 1.4s ease-in-out infinite", ...style }}>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
  </div>;
}
function Card({ children, style }) {
  return <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:14, ...style }}>{children}</div>;
}
function CardHd({ title, sub }) {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
    <span style={{ fontSize:12, fontWeight:500, color:"var(--color-text-primary)" }}>{title}</span>
    {sub && <span style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{sub}</span>}
  </div>;
}
function CustomTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div style={{ background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8, padding:"8px 12px", fontSize:11 }}>
    <div style={{ fontWeight:500, marginBottom:4 }}>{label}</div>
    {payload.map((p,i) => <div key={i} style={{ color:p.color }}>{p.name}: {fmt(p.value)} so'm</div>)}
  </div>;
}

export default function Dashboard() {
  const { t } = useLang();
  const d = t.dashboard;
  const { isSuperAdmin, branchId } = useAuth();
  const [branch, setBranch] = useState("all");
  const effectiveBranch = isSuperAdmin ? (branch==="all" ? null : Number(branch)) : branchId;

  const { data:dash, loading, error, refetch } = useApi(
    () => api.dashboard.get(effectiveBranch),
    [effectiveBranch]
  );

  const kpi      = dash?.data?.kpi ?? {};
  const trend    = dash?.data?.revenue_trend ?? [];
  const byGroup  = dash?.data?.student_by_group ?? [];
  const payments = dash?.data?.recent_payments ?? [];
  const alerts   = dash?.data?.alerts ?? [];

  const diffPct = Number(kpi.prev_revenue) > 0
    ? Math.round((Number(kpi.monthly_revenue)-Number(kpi.prev_revenue))/Number(kpi.prev_revenue)*100)
    : 0;

  const revenueData = trend.map(r => ({
    month: (d.months ?? [])[r.month-1] ?? r.month,
    [d.income||"Daromad"]: Number(r.revenue),
    [d.target||"Maqsad"]:  Number(r.target),
  }));

  const pieData = byGroup.map(g => ({ name:g.name, value:g.count }));

  const ALERT_ST = [
    { bg:"#FCEBEB", ic:"#F09595", tc:"#791F1F", sym:"!" },
    { bg:"#FAEEDA", ic:"#FAC775", tc:"#633806", sym:"!" },
    { bg:"#E1F5EE", ic:"#9FE1CB", tc:"#085041", sym:"i" },
  ];

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
      {/* Topbar */}
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{d.title}</span>
        {isSuperAdmin && (
          <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
            {Object.entries(BRANCH_LABELS).map(([key,label]) => (
              <button key={key} onClick={()=>setBranch(key)} style={{ padding:"4px 10px", borderRadius:20, fontSize:11, cursor:"pointer", fontFamily:"var(--font-sans)", border: branch===key ? "0.5px solid #04342C" : "0.5px solid var(--color-border-tertiary)", background: branch===key ? "#04342C" : "var(--color-background-primary)", color: branch===key ? "#9FE1CB" : "var(--color-text-secondary)", transition:"all .12s" }}>{label}</button>
            ))}
          </div>
        )}
        {error && <button onClick={refetch} style={{ marginLeft:"auto", fontSize:11, color:"#A32D2D", background:"#FCEBEB", border:"none", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>↺ Qayta yuklash</button>}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", background:"var(--color-background-tertiary)", display:"flex", flexDirection:"column", gap:12 }}>
        {/* KPI */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:8 }}>
          {loading ? Array(4).fill(0).map((_,i)=><Skeleton key={i} h={72} r={10}/>) : <>
            <KpiCard label={d.totalStudents}  value={kpi.total_students??0}  sub={`+${kpi.new_students??0} ${d.newThisMonth}`} subColor="#1D9E75"/>
            <KpiCard label={d.monthlyRevenue} value={fmt(kpi.monthly_revenue)} sub={`${diffPct>=0?"+":""}${diffPct}% ${d.vsLastMonth}`} subColor={diffPct>=0?"#1D9E75":"#A32D2D"}/>
            <KpiCard label={d.activeGroups}   value={kpi.active_groups??0}   sub={d.groups}/>
            <KpiCard label={d.debtors}         value={kpi.debtors??0}         sub={`${fmt((kpi.debtors??0)*500000)} so'm`} subColor="#A32D2D"/>
          </>}
        </div>

        {/* Charts */}
        <div className="charts-row" style={{ display:"grid", gridTemplateColumns:"minmax(0,2fr) minmax(0,1fr)", gap:12 }}>
          <Card>
            <CardHd title={d.revenueTrend} sub="2025"/>
            {loading ? <Skeleton h={180}/> : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={revenueData} margin={{ top:4, right:4, bottom:0, left:0 }}>
                  <defs>
                    <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" strokeWidth={0.5}/>
                  <XAxis dataKey="month" tick={{ fontSize:10, fill:"var(--color-text-secondary)" }} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmt} tick={{ fontSize:10, fill:"var(--color-text-secondary)" }} axisLine={false} tickLine={false} width={42}/>
                  <Tooltip content={<CustomTip/>}/>
                  <Area type="monotone" dataKey={d.income||"Daromad"} stroke="#1D9E75" strokeWidth={2} fill="url(#ig)" dot={false} activeDot={{ r:4 }}/>
                  <Legend wrapperStyle={{ fontSize:10, paddingTop:8 }}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card>
            <CardHd title={d.studentDist} sub={d.byGroup}/>
            {loading ? <Skeleton h={180}/> : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value">
                    {pieData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v,n)=>[`${v} talaba`,n]} contentStyle={{ fontSize:11, background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:8 }}/>
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize:10 }} formatter={v=><span style={{ color:"var(--color-text-secondary)" }}>{v}</span>}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Bottom */}
        <div className="bottom-row" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
          <Card>
            <CardHd title={d.recentPayments}/>
            {loading ? Array(4).fill(0).map((_,i)=><Skeleton key={i} h={36} style={{ marginBottom:6 }}/>) :
              payments.map((p,i) => (
                <div key={p.id??i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom: i<payments.length-1?"0.5px solid var(--color-border-tertiary)":"none" }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"#E1F5EE", color:"#085041", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:500, flexShrink:0 }}>
                    {(p.student_name??"?").split(" ").map(w=>w[0]).slice(0,2).join("")}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:500 }}>{p.student_name}</div>
                    <div style={{ fontSize:10, color:"var(--color-text-secondary)" }}>{p.period_month}/{p.period_year}</div>
                  </div>
                  <Badge preset={p.status==="paid"?"green":"red"}>{p.status==="paid"?d.paid:d.debt}</Badge>
                  <span style={{ fontSize:11, fontWeight:500, color:p.status==="paid"?"#1D9E75":"#A32D2D", marginLeft:4 }}>{fmt(p.amount)}</span>
                </div>
              ))
            }
          </Card>
          <Card>
            <CardHd title={d.alerts}/>
            {loading ? Array(3).fill(0).map((_,i)=><Skeleton key={i} h={36} r={8} style={{ marginBottom:6 }}/>) :
              alerts.map((msg,i) => {
                const al = ALERT_ST[i%ALERT_ST.length];
                return <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"7px 10px", borderRadius:8, marginBottom:i<alerts.length-1?6:0, background:al.bg }}>
                  <div style={{ width:16, height:16, borderRadius:"50%", background:al.ic, color:al.tc, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:9, marginTop:1, fontWeight:700 }}>{al.sym}</div>
                  <span style={{ fontSize:10, color:al.tc, lineHeight:1.5 }}>{msg}</span>
                </div>;
              })
            }
          </Card>
        </div>
      </div>
    </div>
  );
}
