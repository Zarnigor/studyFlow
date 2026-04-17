import { useState, useMemo } from "react";

export default function StudentSearch({ students, value, onChange, loading, placeholder }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return students;
    const q = query.toLowerCase();
    return students.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  }, [students, query]);

  const picked = students?.find(s => String(s.id) === String(value)) ?? null;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {/* Search input */}
      <div style={{
        display:"flex", alignItems:"center", gap:7,
        background:"var(--color-background-secondary)",
        border:"0.5px solid var(--color-border-secondary)",
        borderRadius:8, padding:"6px 10px",
        opacity: loading ? 0.6 : 1,
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
          <circle cx="7" cy="7" r="5" stroke="var(--color-text-secondary)" strokeWidth="1.5"/>
          <path d="M11 11l3 3" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={loading ? "Yuklanmoqda..." : (placeholder ?? "Ism yoki telefon...")}
          disabled={loading}
          style={{
            flex:1, border:"none", background:"none", outline:"none",
            fontSize:12, color:"var(--color-text-primary)",
            fontFamily:"var(--font-sans)",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{ border:"none", background:"none", cursor:"pointer", padding:0, lineHeight:1, color:"var(--color-text-secondary)", fontSize:14 }}
          >×</button>
        )}
      </div>

      {/* Student list */}
      <div style={{
        maxHeight:200, overflowY:"auto",
        border:"0.5px solid var(--color-border-secondary)",
        borderRadius:8, background:"var(--color-background-primary)",
      }}>
        {loading ? (
          <div style={{ padding:"10px 12px", fontSize:12, color:"var(--color-text-secondary)" }}>
            Yuklanmoqda...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:"10px 12px", fontSize:12, color:"var(--color-text-secondary)" }}>
            Talaba topilmadi
          </div>
        ) : (
          filtered.map(s => {
            const isSelected = String(s.id) === String(value);
            return (
              <div
                key={s.id}
                onClick={() => onChange(s.id)}
                style={{
                  padding:"8px 12px", cursor:"pointer", fontSize:12,
                  borderBottom:"0.5px solid var(--color-border-tertiary)",
                  background: isSelected ? "var(--color-background-secondary)" : undefined,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--color-background-secondary)"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ""; }}
              >
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{s.full_name}</span>
                <span style={{ color:"var(--color-text-secondary)", fontSize:11 }}>{s.phone}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Selected indicator */}
      {picked && (
        <div style={{ fontSize:11, color:"#1D9E75" }}>
          ✓ Tanlandi: {picked.full_name}
        </div>
      )}
    </div>
  );
}