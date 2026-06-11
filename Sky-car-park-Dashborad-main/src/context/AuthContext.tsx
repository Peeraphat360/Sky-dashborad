// ─────────────────────────────────────────────────────────────────────────────
// src/context/AuthContext.tsx
// Global auth state — ตัวตนจริงอยู่ใน Supabase Auth (JWT) เพื่อให้ผ่าน RLS ของ DB
// ใช้ useAuth() ใน component ใดก็ได้
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AppUser, UserRole, RolePermissions, getPermissions, usernameToEmail } from '../config/users';

interface AuthState {
  user: AppUser | null;
  role: UserRole | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOGGED_OUT: AuthState = { user: null, role: null, permissions: null, isAuthenticated: false };

// แปลง Supabase Auth user → AppUser (role มาจาก app_metadata ที่ตั้งตอนสร้างบัญชี)
function toAppUser(u: User): AppUser {
  const email = u.email ?? '';
  const username = email.split('@')[0];
  const role: UserRole = (u.app_metadata?.dashboard_role as UserRole) ?? (username === 'admin' ? 'admin' : 'manager');
  const displayName = (u.user_metadata?.display_name as string) ?? (username.charAt(0).toUpperCase() + username.slice(1));
  return { username, role, displayName, email };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(LOGGED_OUT);
  // กัน "หน้า login กะพริบ" ตอนรีเฟรช — รอเช็ค session ที่เก็บไว้ก่อนค่อย render
  const [ready, setReady] = useState(false);

  const applySession = (session: Session | null) => {
    // ส่ง JWT ของแอดมินเข้า Realtime ก่อนเสมอ — หลังเปิด RLS การ subscribe
    // (popup จองใหม่ + live update) ต้องใช้ token นี้ถึงจะได้รับ event
    // ทำก่อน setState เพื่อให้ channel ที่ App สร้างหลัง re-render ใช้ token ที่ถูกต้อง
    supabase.realtime.setAuth(session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY);
    if (session?.user) {
      const user = toAppUser(session.user);
      setState({ user, role: user.role, permissions: getPermissions(user.role), isAuthenticated: true });
    } else {
      setState(LOGGED_OUT);
    }
  };

  useEffect(() => {
    // ล้าง session แบบเก่าที่เคยเก็บ username/password ไว้ตรงๆ (เลิกใช้แล้ว)
    localStorage.removeItem('sky_session');

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !data.user) return false;
    applySession(data.session);
    return true;
  }, []);

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setState(LOGGED_OUT);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

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
