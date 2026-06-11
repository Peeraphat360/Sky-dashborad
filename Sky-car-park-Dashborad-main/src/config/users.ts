export type UserRole = 'admin' | 'manager';
export type TabId = 'dashboard' | 'bookings' | 'parking' | 'history' | 'revenue';

// ผู้ใช้ที่ login แล้ว (ตัวตนจริงอยู่ใน Supabase Auth — ไม่มีรหัสผ่านในโค้ดอีกต่อไป)
export interface AppUser {
  username: string;
  role: UserRole;
  displayName: string;
  email: string;
}

export interface RolePermissions {
  tabs: TabId[];
  canAddBooking: boolean;
  canCancelBooking: boolean;
  canEditBooking: boolean;
  canCheckIn: boolean;
  canMarkPaid: boolean;
  canMoveSlot: boolean;
}

// ─── Permissions ──────────────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    tabs: ['bookings', 'parking'],
    canAddBooking:    true,
    canCancelBooking: true,
    canEditBooking:   true,
    canCheckIn:       true,
    canMarkPaid:      true,
    canMoveSlot:      false,
  },
  manager: {
    tabs: ['dashboard', 'bookings', 'parking', 'history', 'revenue'],
    canAddBooking:    true,
    canCancelBooking: true,
    canEditBooking:   true,
    canCheckIn:       true,
    canMarkPaid:      true,
    canMoveSlot:      true,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

// ช่อง username ในหน้า login รับได้ทั้งชื่อสั้น (admin / manager) และอีเมลเต็ม —
// บัญชีจริงใน Supabase Auth ใช้อีเมล @skycarpark.com
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@skycarpark.com`;
}
