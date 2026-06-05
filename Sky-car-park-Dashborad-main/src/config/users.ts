export type UserRole = 'admin' | 'manager';
export type TabId = 'dashboard' | 'bookings' | 'parking' | 'history' | 'revenue';

export interface AppUser {
  username: string;
  password: string;
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

// 컴� Users 컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴
export const USERS: AppUser[] = [
  {
    username:    'admin',
    password:    'admin1234',
    role:        'admin',
    displayName: 'Admin',
    email:       'admin@skycarpark.com',
  },
  {
    username:    'manager',
    password:    'manager1234',
    role:        'manager',
    displayName: 'Manager',
    email:       'manager@skycarpark.com',
  },
];

// 컴� Permissions 컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴컴
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

export function authenticate(username: string, password: string): AppUser | null {
  return USERS.find(u => u.username === username && u.password === password) ?? null;
}

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}
