import { useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";

/**
 * ProtectedRoute — login bo'lmasa LoginPage ko'rsatadi
 * App.jsx da barcha content ni wrap qiling:
 *   <ProtectedRoute><AppInner /></ProtectedRoute>
 */
export function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <SplashScreen />;
  if (!isLoggedIn) return <LoginPage />;
  return children;
}

/**
 * RoleGuard — ruxsatsiz rollar uchun fallback ko'rsatadi
 * Ishlatish:
 *   <RoleGuard roles={["super_admin", "admin"]}>
 *     <Settings />
 *   </RoleGuard>
 */
export function RoleGuard({ roles, children, fallback = null }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return fallback ?? <AccessDenied />;
  return children;
}

// ── Loading splash ─────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#04342C", gap: 16,
    }}>
      <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
        <rect x="2" y="8" width="24" height="17" rx="3" stroke="#9FE1CB" strokeWidth="1.5"/>
        <path d="M9 8V6a5 5 0 0110 0v2" stroke="#9FE1CB" strokeWidth="1.5"/>
        <circle cx="14" cy="17" r="2.5" fill="#9FE1CB"/>
      </svg>
      <div style={{ color: "#9FE1CB", fontSize: 18, fontWeight: 500 }}>StudyFlow</div>
      <LoadingDots />
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform: translateY(0); opacity:.4; }
          40%          { transform: translateY(-6px); opacity:1; }
        }
      `}</style>
      {[0, 0.16, 0.32].map((d, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#1D9E75",
          animation: `bounce 1s ease-in-out ${d}s infinite`,
        }}/>
      ))}
    </div>
  );
}

// ── Access denied ──────────────────────────────────────────────
function AccessDenied() {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 10, color: "var(--color-text-secondary)", fontSize: 13,
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="17" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
        <path d="M14 20h12M20 14v12" stroke="var(--color-border-secondary)" strokeWidth="1.5"
          strokeLinecap="round" transform="rotate(45 20 20)"/>
      </svg>
      <div>Bu sahifaga ruxsatingiz yo'q</div>
    </div>
  );
}
