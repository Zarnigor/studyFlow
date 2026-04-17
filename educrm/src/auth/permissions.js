/**
 * usePermissions — markaziy ruxsatlar tizimi
 *
 * Barcha sahifalar va komponentlar shu hookdan foydalanadi.
 * Rolni o'zgartirish uchun faqat shu faylni o'zgartirish kifoya.
 *
 * Rollar:
 *   super_admin — hamma narsaga ruxsat, barcha filiallar
 *   admin       — o'z filiali, deyarli hamma narsa
 *   manager     — o'z filiali, ko'rish + talabalar boshqarish
 *   teacher     — faqat o'z guruhlari, davomat belgilash
 *   cashier     — faqat to'lovlar
 */
import { useAuth } from "./AuthContext";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? "";

  const is = {
    superAdmin: role === "super_admin",
    admin:      role === "admin",
    manager:    role === "manager",
    teacher:    role === "teacher",
    cashier:    role === "cashier",
  };

  const adminLevel   = is.superAdmin || is.admin;
  const staffLevel   = is.superAdmin || is.admin || is.manager;
  const canSeeFinance= is.superAdmin || is.admin || is.manager || is.cashier;

  return {
    role,
    is,

    // ── Sidebar nav visibility ─────────────────────────────────
    nav: {
      dashboard:  true,                              // hammaga
      students:   staffLevel || is.teacher || is.cashier,
      groups:     staffLevel || is.teacher,
      payments:   staffLevel || is.cashier,
      attendance: staffLevel || is.teacher,
      teachers:   adminLevel || is.manager,          // manager faqat ko'radi
      leads:      staffLevel,                        // teacher va cashier ko'rmaydi
      reports:    staffLevel || is.cashier,
      settings:   true,  // Hammaga ko'rinadi, lekin ichida noAccess tekshiruvi bor
      users:      adminLevel,
    },

    // ── Dashboard ─────────────────────────────────────────────
    dashboard: {
      canSeeBranchFilter: is.superAdmin,
      canSeeRevenue:      canSeeFinance,
      canSeeDebtors:      canSeeFinance,
      canSeeLeadStats:    staffLevel,
      // Teacher dashboard — faqat o'z guruhlari statistikasi
      limitedView:        is.teacher || is.cashier,
    },

    // ── Students ──────────────────────────────────────────────
    students: {
      canView:        true,                          // hammaga
      canCreate:      staffLevel,
      canEdit:        staffLevel,
      canDelete:      adminLevel,
      canExport:      staffLevel,
      // Teacher faqat o'z guruhi talabalarini ko'radi (backend filtrlab beradi)
      isLimited:      is.teacher,
    },

    // ── Groups ────────────────────────────────────────────────
    groups: {
      canView:        staffLevel || is.teacher,
      canCreate:      staffLevel,
      canEdit:        staffLevel,
      canDelete:      adminLevel,
      canAddStudent:  staffLevel,
      canRemoveStudent: staffLevel,
      // Teacher faqat o'z guruhlarini ko'radi
      isLimited:      is.teacher,
    },

    // ── Lessons ───────────────────────────────────────────────
    lessons: {
      canView:        staffLevel || is.teacher,
      canCreate:      staffLevel || is.teacher,      // teacher o'z guruhida dars yarata oladi
      canEdit:        staffLevel || is.teacher,      // teacher o'z darsini
      canDelete:      staffLevel,
      canMarkAtt:     staffLevel || is.teacher,      // teacher o'z darsida
      canViewReport:  staffLevel || is.teacher,
      isLimited:      is.teacher,                    // faqat o'z guruhlari
      noAccess:       is.cashier,
    },

    // ── Payments ──────────────────────────────────────────────
    payments: {
      canView:        canSeeFinance,
      canCreate:      staffLevel || is.cashier,
      canMarkPaid:    staffLevel || is.cashier,
      canDelete:      adminLevel,
      canGenerate:    adminLevel,                    // oylik to'lov generatsiya
      canExport:      staffLevel,
      noAccess:       is.teacher,
    },

    // ── Leads ─────────────────────────────────────────────────
    leads: {
      canView:        staffLevel,
      canCreate:      staffLevel,
      canEdit:        staffLevel,
      canDelete:      adminLevel,
      canConvert:     staffLevel,
      noAccess:       is.teacher || is.cashier,
    },

    // ── Teachers ──────────────────────────────────────────────
    teachers: {
      canView:        adminLevel || is.manager,
      canCreate:      adminLevel,
      canEdit:        adminLevel,
      canDelete:      adminLevel,
      canViewSalary:  adminLevel,
      noAccess:       is.teacher || is.cashier,
    },

    // ── Reports ───────────────────────────────────────────────
    reports: {
      canView:        staffLevel || is.cashier,
      canSeePayments: canSeeFinance,
      canSeeDebtors:  canSeeFinance,
      canSeeSummary:  staffLevel,
      canSeeAttRep:   staffLevel || is.teacher,
      canExport:      staffLevel,
      noAccess:       is.teacher,                    // teacher hisobot ko'rmaydi
    },

    // ── Attendance ────────────────────────────────────────────
    attendance: {
      canView:        staffLevel || is.teacher,
      canMark:        staffLevel || is.teacher,
      isLimited:      is.teacher,
      noAccess:       is.cashier,
    },

    // ── Settings ──────────────────────────────────────────────
    settings: {
      canView:        adminLevel,
      canEdit:        adminLevel,
      noAccess:       is.manager || is.teacher || is.cashier,
    },

    // ── Shared helpers ────────────────────────────────────────
    canSeeBranches:  is.superAdmin,
    canManageUsers:  adminLevel,
    canViewFinance:  canSeeFinance,
  };
}
