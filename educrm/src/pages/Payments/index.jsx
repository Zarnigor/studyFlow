import { useState } from "react";
import StudentSearch from "../../components/StudentSearch";
import { useLang } from "../../i18n/LangContext";
import { useAuth } from "../../auth/AuthContext";
import { usePermissions } from "../../auth/permissions";
import { useApi, useMutation } from "../../api/useApi";
import { api } from "../../api/client";
import {
  Badge, KpiCard, FilterPills, SearchBar, Button,
  Modal, FormField, Select, ModalButtons,
  Table, TableRow, Td, EmptyState, NoAccess,
} from "../../components/ui";

const TYPE_PRESET   = { cash:"gray", card:"blue", payme:"purple", click:"amber" };
const STATUS_PRESET = { paid:"green", debt:"red", pending:"amber" };
function fmt(n){ return Number(n||0).toLocaleString("uz-UZ"); }
function initials(n){ return (n??"").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"??"; }

export default function Payments() {
  const { t, lang } = useLang();
  const isUz = lang !== "en";
  const p = t.payments;
  const { branchId, isSuperAdmin } = useAuth();
  const P = usePermissions();
  const perm = P.payments;

  if (perm.noAccess) {
    return <NoAccess message="To'lovlar bo'limine ruxsatingiz yo'q" hint="O'qituvchilar to'lovlarni boshqara olmaydi"/>;
  }

  const [filter,    setFilter]    = useState("all");
  const [query,     setQuery]     = useState("");
  const [page,      setPage]      = useState(1);
  const [debtModal,  setDebtModal]  = useState(false);
  const [newModal,   setNewModal]   = useState(false);
  const [debtForm,   setDebtForm]   = useState({ paymentId:"", type:"cash" });
  const [newForm,    setNewForm]    = useState({
    student_id:"", amount:"", method:"cash",
    payment_date: new Date().toISOString().slice(0,10),
  });
  const [modalStudents,    setModalStudents]    = useState([]);
  const [loadingModalStuds,setLoadingModalStuds]= useState(false);

  const { data, loading, refetch } = useApi(
    () => api.payments.list({
      branch_id: isSuperAdmin ? undefined : branchId,
      status:    filter !== "all" ? filter : undefined,
      q:         query || undefined,
      page,
      limit: 20,
    }),
    [filter, query, page, branchId]
  );
  const payments = data?.data ?? [];
  const meta     = data?.meta ?? {};

  const paidC  = payments.filter(x=>x.status==="paid").length;
  const debtC  = payments.filter(x=>x.status==="debt").length;
  const pendC  = payments.filter(x=>x.status==="pending").length;
  const paidAmt= payments.filter(x=>x.status==="paid").reduce((a,x)=>a+Number(x.amount),0);
  const debtAmt= payments.filter(x=>x.status==="debt").reduce((a,x)=>a+Number(x.amount),0);

  const { mutate:updatePay } = useMutation((id,d)=>api.payments.update(id,d));
  const { mutate:createPay } = useMutation(d=>api.payments.create(d));
  const { data:debtData }    = useApi(()=>api.payments.debtors({branch_id:isSuperAdmin?undefined:branchId}),[]);
  const unpaidOptions = debtData?.data ?? [];

  async function loadModalStudents() {
    setLoadingModalStuds(true);
    try {
      const res = await api.students.list({
        branch_id: isSuperAdmin ? undefined : branchId,
        status:    "active",
        limit:     200,
      });
      setModalStudents(res?.data ?? []);
    } catch(e) {
      console.error("Modal students error:", e);
    } finally {
      setLoadingModalStuds(false);
    }
  }

  async function markPaid(id){ await updatePay(id,{status:"paid"}); refetch(); }

  async function handlePayDebt() {
    if (!debtForm.paymentId) return;
    await updatePay(Number(debtForm.paymentId), { status:"paid", method:debtForm.type });
    setDebtModal(false);
    setDebtForm({ paymentId:"", type:"cash" });
    refetch();
  }

  async function handleCreatePayment() {
    if (!newForm.student_id) {
      alert(isUz ? "Talabani tanlang" : "Select a student");
      return;
    }
    if (!newForm.amount) {
      alert(isUz ? "Summani kiriting" : "Enter amount");
      return;
    }
    try {
      const pd = new Date(newForm.payment_date || new Date().toISOString().slice(0,10));
      await createPay({
        branch_id:    isSuperAdmin ? undefined : branchId,
        student_id:   Number(newForm.student_id),
        amount:       Number(newForm.amount),
        discount:     0,
        method:       newForm.method,
        status:       "paid",
        period_month: pd.getMonth() + 1,
        period_year:  pd.getFullYear(),
        payment_date: newForm.payment_date || null,
      });
      setNewModal(false);
      setNewForm({ student_id:"", amount:"", method:"cash", payment_date: new Date().toISOString().slice(0,10) });
      setModalStudents([]);
      refetch();
    } catch(e) { alert(e.message); }
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, position:"relative" }}>
      <div style={{ padding:"10px 16px", background:"var(--color-background-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:14, fontWeight:500 }}>{p.title}</span>
        <SearchBar value={query} onChange={v=>{setQuery(v);setPage(1);}} placeholder={p.search}/>
        {perm.canCreate && (
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            <Button variant="ghost" onClick={()=>setDebtModal(true)}>Qarzni to'lash</Button>
            <Button onClick={()=>{ setNewModal(true); loadModalStudents(); }}>{p.add}</Button>
          </div>
        )}
      </div>

      <div style={{ flex:1, padding:"14px 16px", overflowY:"auto", background:"var(--color-background-tertiary)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
          <KpiCard label={p.stats.total}   value={meta.total??payments.length}/>
          <KpiCard label={p.stats.paid}    value={paidC}  sub={`${fmt(paidAmt)} ${p.currency}`} subColor="#1D9E75"/>
          <KpiCard label={p.stats.debtors} value={debtC}  sub={`${fmt(debtAmt)} ${p.currency}`} subColor="#A32D2D"/>
          <KpiCard label={p.stats.pending} value={pendC}/>
        </div>

        <FilterPills options={p.filters} keys={p.filterKeys} active={filter} onChange={k=>{setFilter(k);setPage(1);}}/>

        {loading ? (
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:100,color:"var(--color-text-secondary)",fontSize:12 }}>Yuklanmoqda...</div>
        ) : (
          <Table headers={Object.values(p.table)}>
            {payments.length ? payments.map(item=>(
              <TableRow key={item.id}>
                <Td>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:28,height:28,borderRadius:"50%",background:"#E1F5EE",color:"#085041",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:500,flexShrink:0 }}>
                      {initials(item.student_name)}
                    </div>
                    <div>
                      <div style={{ fontWeight:500,fontSize:12 }}>{item.student_name??`#${item.student_id}`}</div>
                      <div style={{ fontSize:10,color:"var(--color-text-secondary)" }}>{item.receipt_no}</div>
                    </div>
                  </div>
                </Td>
                <Td style={{ fontSize:11,color:"var(--color-text-secondary)" }}>{item.payment_date ?? `${item.period_month}/${item.period_year}`}</Td>
                <Td style={{ fontWeight:500 }}>{fmt(item.amount)}</Td>
                <Td><Badge preset={TYPE_PRESET[item.method]??"gray"}>{p.types[item.method]??item.method}</Badge></Td>
                <Td><Badge preset={STATUS_PRESET[item.status]}>{p.status[item.status]}</Badge></Td>
                <Td>
                  {item.status!=="paid" && perm.canMarkPaid && (
                    <button onClick={()=>markPaid(item.id)}
                      style={{ padding:"3px 9px",borderRadius:6,fontSize:10,cursor:"pointer",border:"0.5px solid #1D9E75",background:"none",color:"#1D9E75",fontFamily:"var(--font-sans)",transition:"all .12s" }}
                      onMouseEnter={e=>{e.currentTarget.style.background="#1D9E75";e.currentTarget.style.color="#fff";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="#1D9E75";}}>
                      {p.markPaid}
                    </button>
                  )}
                </Td>
              </TableRow>
            )) : <tr><td colSpan={6}><EmptyState message={t.common.notFound}/></td></tr>}
          </Table>
        )}

        {meta.pages>1 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:12 }}>
            {Array.from({length:meta.pages},(_,i)=>i+1).map(pg=>(
              <button key={pg} onClick={()=>setPage(pg)}
                style={{ width:30,height:30,borderRadius:6,border:"0.5px solid var(--color-border-tertiary)",background:page===pg?"#1D9E75":"var(--color-background-primary)",color:page===pg?"#fff":"var(--color-text-secondary)",cursor:"pointer",fontSize:12,fontFamily:"var(--font-sans)" }}>
                {pg}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Mavjud qarzni to'lash */}
      {perm.canCreate && (
        <Modal open={debtModal} onClose={()=>setDebtModal(false)}>
          <div style={{ fontSize:14, fontWeight:500 }}>Qarzni to'lash</div>
          <FormField label="Qarzdor talaba">
            <Select value={debtForm.paymentId} onChange={v=>setDebtForm(prev=>({...prev,paymentId:v}))}>
              <option value="">Tanlang...</option>
              {unpaidOptions.map(x=>(
                <option key={x.id} value={x.id}>
                  {x.student_name??`#${x.student_id}`} — {fmt(x.amount)} so'm ({x.period_month}/{x.period_year})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={p.form.type}>
            <Select value={debtForm.type} onChange={v=>setDebtForm(prev=>({...prev,type:v}))}>
              {Object.entries(p.types).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <ModalButtons>
            <Button variant="ghost" onClick={()=>setDebtModal(false)}>{p.form.cancel}</Button>
            <Button onClick={handlePayDebt}>{p.form.save}</Button>
          </ModalButtons>
        </Modal>
      )}

      {/* Modal 2: Yangi to'lov yaratish */}
      {perm.canCreate && (
        <Modal open={newModal} onClose={()=>{ setNewModal(false); setModalStudents([]); }}>
          <div style={{ fontSize:14, fontWeight:500 }}>{p.form.title}</div>
          <FormField label="Talaba">
            <StudentSearch
              students={modalStudents}
              value={newForm.student_id}
              onChange={id => setNewForm(prev => ({...prev, student_id: id}))}
              loading={loadingModalStuds}
              placeholder={isUz ? "Ism yoki telefon..." : "Name or phone..."}
            />
          </FormField>
          <FormField label="Summa (so'm)">
            <input
              type="number" value={newForm.amount} placeholder="0"
              onChange={e=>setNewForm(prev=>({...prev,amount:e.target.value}))}
              style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, width:"100%", fontFamily:"var(--font-sans)", outline:"none", background:"var(--color-background-primary)", color:"var(--color-text-primary)" }}/>
          </FormField>
          <FormField label={isUz ? "TO'LOV SANASI" : "PAYMENT DATE"}>
            <input
              type="date"
              value={newForm.payment_date}
              onChange={e=>setNewForm(prev=>({...prev, payment_date:e.target.value}))}
              style={{ border:"0.5px solid var(--color-border-secondary)", borderRadius:8, padding:"7px 10px", fontSize:12, color:"var(--color-text-primary)", background:"var(--color-background-primary)", fontFamily:"var(--font-sans)", outline:"none", width:"100%", boxSizing:"border-box" }}
            />
          </FormField>
          <FormField label={p.form.type}>
            <Select value={newForm.method} onChange={v=>setNewForm(prev=>({...prev,method:v}))}>
              {Object.entries(p.types).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <ModalButtons>
            <Button variant="ghost" onClick={()=>setNewModal(false)}>{p.form.cancel}</Button>
            <Button onClick={handleCreatePayment}>{p.form.save}</Button>
          </ModalButtons>
        </Modal>
      )}
    </div>
  );
}
