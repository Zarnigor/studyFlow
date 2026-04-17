import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, tokens } from "../api/client";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // "checking saved token"

  // On mount: restore session from saved token
  useEffect(() => {
    if (!tokens.access) { setLoading(false); return; }
    api.auth.me()
      .then(u => setUser(u))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  // Forced logout when refresh token expires
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, []);

  const login = useCallback(async (phone, password) => {
    const data = await api.auth.login(phone, password);
    tokens.set(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    isLoggedIn:   !!user,
    isSuperAdmin: user?.role === "super_admin",
    isAdmin:      ["super_admin","admin"].includes(user?.role),
    isStaff:      ["super_admin","admin","manager","cashier"].includes(user?.role),
    branchId:     user?.branch_id ?? null,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
