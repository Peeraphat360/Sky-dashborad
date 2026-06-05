// ─────────────────────────────────────────────────────────────────────────────
// src/context/AuthContext.tsx
// Global auth state — ใช้ useAuth() ใน component ใดก็ได้
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AppUser, UserRole, RolePermissions, getPermissions, authenticate } from '../config/users';

interface AuthState {
  user: AppUser | null;
  role: UserRole | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, remember?: boolean) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    permissions: null,
    isAuthenticated: false,
  });

  // ─── Auto-restore session from localStorage on mount ──────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sky_session');
      if (saved) {
        const { username, password } = JSON.parse(saved);
        const user = authenticate(username, password);
        if (user) {
          setState({
            user,
            role: user.role,
            permissions: getPermissions(user.role),
            isAuthenticated: true,
          });
        } else {
          // Credentials no longer valid, clear storage
          localStorage.removeItem('sky_session');
        }
      }
    } catch {
      localStorage.removeItem('sky_session');
    }
  }, []);

  const login = useCallback((username: string, password: string, remember: boolean = false): boolean => {
    const user = authenticate(username, password);
    if (!user) return false;
    setState({
      user,
      role: user.role,
      permissions: getPermissions(user.role),
      isAuthenticated: true,
    });
    if (remember) {
      localStorage.setItem('sky_session', JSON.stringify({ username, password }));
    } else {
      localStorage.removeItem('sky_session');
    }
    return true;
  }, []);

  const logout = useCallback(() => {
    setState({ user: null, role: null, permissions: null, isAuthenticated: false });
    localStorage.removeItem('sky_session');
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook หลัก
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Hook shorthand สำหรับดึง permissions
export function usePermissions(): RolePermissions {
  const { permissions } = useAuth();
  if (!permissions) throw new Error('No permissions — user not logged in');
  return permissions;
}