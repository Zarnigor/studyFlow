import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone || !password) { setError("Telefon va parolni kiriting"); return; }
    setError(""); setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err.message ?? "Telefon yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#04342C",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
    }}>
      {/* Background pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "radial-gradient(circle, #9FE1CB 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 380, padding: "0 16px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(29,158,117,.25)", marginBottom: 14,
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="24" height="17" rx="3" stroke="#9FE1CB" strokeWidth="1.5"/>
              <path d="M9 8V6a5 5 0 0110 0v2" stroke="#9FE1CB" strokeWidth="1.5"/>
              <circle cx="14" cy="17" r="2.5" fill="#9FE1CB"/>
            </svg>
          </div>
          <div style={{ color: "#9FE1CB", fontSize: 24, fontWeight: 600, letterSpacing: "-.02em" }}>
            StudyFlow
          </div>
          <div style={{ color: "rgba(255,255,255,.35)", fontSize: 13, marginTop: 4 }}>
            O'quv Markaz Boshqaruv Tizimi
          </div>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{
          background: "var(--color-background-primary, #fff)",
          borderRadius: 16, padding: "28px 28px 24px",
          border: "0.5px solid rgba(255,255,255,.08)",
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 20 }}>
            Tizimga kirish
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "#FCEBEB", color: "#791F1F", borderRadius: 8,
              padding: "9px 12px", fontSize: 13, marginBottom: 16,
              display: "flex", alignItems: "center", gap: 7,
            }}>
              <span style={{ fontSize: 15 }}>⚠</span> {error}
            </div>
          )}

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: "block", fontSize: 10, fontWeight: 500,
              color: "var(--color-text-secondary)", letterSpacing: ".06em",
              textTransform: "uppercase", marginBottom: 6,
            }}>Telefon raqam</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67" autoComplete="tel"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "0.5px solid var(--color-border-secondary, rgba(0,0,0,.2))",
                borderRadius: 9, outline: "none",
                background: "var(--color-background-primary)",
                color: "var(--color-text-primary)",
                fontFamily: "inherit", transition: "border-color .15s",
              }}
              onFocus={e => e.target.style.borderColor = "#1D9E75"}
              onBlur={e  => e.target.style.borderColor = "var(--color-border-secondary, rgba(0,0,0,.2))"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 22 }}>
            <label style={{
              display: "block", fontSize: 10, fontWeight: 500,
              color: "var(--color-text-secondary)", letterSpacing: ".06em",
              textTransform: "uppercase", marginBottom: 6,
            }}>Parol</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                style={{
                  width: "100%", padding: "10px 40px 10px 12px", fontSize: 13,
                  border: "0.5px solid var(--color-border-secondary, rgba(0,0,0,.2))",
                  borderRadius: 9, outline: "none",
                  background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                  fontFamily: "inherit", transition: "border-color .15s", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "#1D9E75"}
                onBlur={e  => e.target.style.borderColor = "var(--color-border-secondary, rgba(0,0,0,.2))"}
              />
              <button
                type="button" onClick={() => setShowPass(p => !p)}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-text-secondary)", fontSize: 14, padding: 4,
                }}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "11px", fontSize: 14, fontWeight: 500,
              background: loading ? "#5DCAA5" : "#1D9E75",
              color: "#fff", border: "none", borderRadius: 9,
              cursor: loading ? "default" : "pointer",
              fontFamily: "inherit", transition: "background .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#0F6E56"; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#1D9E75"; }}
          >
            {loading ? (
              <>
                <Spinner /> Kirish...
              </>
            ) : "Kirish"}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "var(--color-text-secondary)", marginTop: 18 }}>
            Muammo bo'lsa admin bilan bog'laning
          </div>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.2)", marginTop: 20 }}>
          StudyFlow v1.0 · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,.3)" strokeWidth="2"/>
      <path d="M8 2a6 6 0 016 6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
