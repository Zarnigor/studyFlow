/**
 * AuthContext — JWT token + user state
 * src/auth/AuthContext.jsx
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService, api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: check if token valid
  useEffect(() => {
    if (!authService.isLoggedIn()) { setLoading(false); return; }
    api.auth.me()
      .then(u => setUser(u))
      .catch(() => { authService.logout(); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for forced logout (token refresh failed)
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener("auth:logout", handler);
    return () => window.removeEventListener("auth:logout", handler);
  }, []);

  const login = useCallback(async (phone, password) => {
    const u = await authService.login(phone, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);


/**
 * Login page component (drop-in)
 * src/auth/LoginPage.jsx
 */
import { useState } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(phone, password);
    } catch (err) {
      setError(err.message ?? "Login yoki parol noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#04342C" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, padding: 32, width: 340, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#04342C", marginBottom: 4 }}>EduCRM</div>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>Tizimga kiring</div>

        {error && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: "#666", textTransform: "uppercase", letterSpacing: ".05em" }}>TELEFON</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+998901234567" required
            style={{ border: "0.5px solid #ccc", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: "#666", textTransform: "uppercase", letterSpacing: ".05em" }}>PAROL</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required
            style={{ border: "0.5px solid #ccc", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }}
          />
        </div>

        <button type="submit" disabled={loading}
          style={{ background: loading ? "#5DCAA5" : "#1D9E75", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 500, cursor: loading ? "default" : "pointer", marginTop: 4 }}>
          {loading ? "Kirish..." : "Kirish"}
        </button>
      </form>
    </div>
  );
}
