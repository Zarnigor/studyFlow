// ─── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ av, palette, size = 28 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: palette.bg, color: palette.tc,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 500, flexShrink: 0,
      }}
    >
      {av}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_PRESETS = {
  green:   { background: "#E1F5EE", color: "#085041" },
  red:     { background: "#FCEBEB", color: "#791F1F" },
  amber:   { background: "#FAEEDA", color: "#633806" },
  blue:    { background: "#E6F1FB", color: "#0C447C" },
  purple:  { background: "#EEEDFE", color: "#3C3489" },
  gray:    { background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
};

export function Badge({ children, preset, style }) {
  const base = preset ? BADGE_PRESETS[preset] : {};
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 500, whiteSpace: "nowrap",
      ...base, ...style,
    }}>
      {children}
    </span>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub, subColor }) {
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 10, padding: "10px 13px",
    }}>
      <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginBottom: 3, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1, color: "var(--color-text-primary)" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, marginTop: 3, color: subColor || "var(--color-text-secondary)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────
export function ProgressBar({ percent, color = "#1D9E75", height = 3 }) {
  return (
    <div style={{ height, background: "var(--color-border-tertiary)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${percent}%`, background: color, borderRadius: 2, transition: "width .3s" }} />
    </div>
  );
}

// ─── Filter Pills ─────────────────────────────────────────────────────────────
export function FilterPills({ options, keys, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
      {options.map((label, i) => {
        const key = keys[i];
        const isActive = active === key;
        return (
          <button key={key} onClick={() => onChange(key)}
            style={{
              padding: "4px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              border: isActive ? "0.5px solid #5DCAA5" : "0.5px solid var(--color-border-tertiary)",
              background: isActive ? "#E1F5EE" : "var(--color-background-primary)",
              color: isActive ? "#0F6E56" : "var(--color-text-secondary)",
              fontFamily: "var(--font-sans)", transition: "all .12s",
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder, style }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "var(--color-background-secondary)",
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 8, padding: "5px 10px", ...style,
    }}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="var(--color-text-secondary)" strokeWidth="1.5" />
        <path d="M11 11l3 3" stroke="var(--color-text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="searchbar-input"
        style={{
          border: "none", background: "none", outline: "none",
          fontSize: 12, color: "var(--color-text-primary)",
          fontFamily: "var(--font-sans)", width: 160,
        }}
      />
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({ children, onClick, variant = "primary", style }) {
  const styles = {
    primary: { background: "#1D9E75", color: "#fff", border: "none" },
    secondary: { background: "var(--color-background-secondary)", color: "var(--color-text-primary)", border: "0.5px solid var(--color-border-tertiary)" },
    danger: { background: "none", color: "#A32D2D", border: "0.5px solid #F09595" },
    ghost: { background: "none", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)" },
  };
  return (
    <button onClick={onClick}
      style={{
        borderRadius: 8, padding: "6px 12px", fontSize: 12,
        cursor: "pointer", fontFamily: "var(--font-sans)",
        whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5,
        transition: "background .12s", ...styles[variant], ...style,
      }}>
      {children}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, children, side = false }) {
  if (!open) return null;
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: side ? "flex-start" : "center",
        justifyContent: side ? "flex-end" : "center",
        zIndex: 100, padding: side ? 10 : 16,
      }}
    >
      <div
        className="modal-box"
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 12, padding: 20,
          width: "100%",
          maxWidth: side ? 360 : 480,
          maxHeight: side ? "calc(100dvh - 20px)" : "90dvh",
          overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
        {children}
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function FormField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  border: "0.5px solid var(--color-border-secondary)", borderRadius: 8,
  padding: "7px 10px", fontSize: 12,
  color: "var(--color-text-primary)", background: "var(--color-background-primary)",
  fontFamily: "var(--font-sans)", outline: "none", width: "100%",
};

export function Input({ value, onChange, placeholder, type = "text" }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />;
}

export function Select({ value, onChange, children }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>{children}</select>;
}

export function Textarea({ value, onChange, placeholder }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, resize: "none", height: 70, lineHeight: 1.5 }} />;
}

// ─── Modal Buttons Row ────────────────────────────────────────────────────────
export function ModalButtons({ children }) {
  return <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>{children}</div>;
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ message }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, color: "var(--color-text-secondary)", fontSize: 12 }}>
      {message}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ headers, children }) {
  return (
    <div style={{ background: "var(--color-background-primary)", borderRadius: 10, border: "0.5px solid var(--color-border-tertiary)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: "left", padding: "7px 11px", fontSize: 10, color: "var(--color-text-secondary)", fontWeight: 500, borderBottom: "0.5px solid var(--color-border-tertiary)", background: "var(--color-background-secondary)", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children, onClick }) {
  return (
    <tr onClick={onClick}
      style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", cursor: onClick ? "pointer" : "default", transition: "background .1s" }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "var(--color-background-secondary)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = ""; }}
    >
      {children}
    </tr>
  );
}

export function Td({ children, style }) {
  return <td style={{ padding: "7px 11px", color: "var(--color-text-primary)", verticalAlign: "middle", ...style }}>{children}</td>;
}

// ─── Stars Rating ─────────────────────────────────────────────────────────────
export function Stars({ rating }) {
  return (
    <span style={{ color: "#BA7517", fontSize: 11 }}>
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
      {" "}{rating}
    </span>
  );
}

// ─── No Access ────────────────────────────────────────────────
export function NoAccess({ message, hint }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", background:"var(--color-background-tertiary)" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--color-text-secondary)", fontSize:13 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:"#FCEBEB", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#F09595" strokeWidth="1.5"/>
            <path d="M9 9l6 6M15 9l-6 6" stroke="#F09595" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontWeight:500, color:"var(--color-text-primary)" }}>{message ?? "Ruxsat yo'q"}</div>
        {hint && <div style={{ fontSize:12, color:"var(--color-text-secondary)", textAlign:"center", maxWidth:280 }}>{hint}</div>}
      </div>
    </div>
  );
}

// ─── Read-only banner ─────────────────────────────────────────
export function ReadOnlyBanner({ message }) {
  return (
    <div style={{ padding:"6px 12px", background:"#E6F1FB", borderBottom:"0.5px solid #85B7EB", display:"flex", alignItems:"center", gap:7, fontSize:11, color:"#0C447C", flexShrink:0 }}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
        <circle cx="8" cy="8" r="6.5" stroke="#378ADD" strokeWidth="1.2"/>
        <path d="M8 7v4M8 5.5v.5" stroke="#378ADD" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      {message}
    </div>
  );
}

// ─── Coming Soon ──────────────────────────────────────────────
export function ComingSoon({ message }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:300, color:"var(--color-text-secondary)", gap:10, fontSize:12 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="10" width="28" height="20" rx="4" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
        <circle cx="18" cy="20" r="2.5" fill="var(--color-border-secondary)"/>
      </svg>
      {message ?? "Tez orada..."}
    </div>
  );
}
