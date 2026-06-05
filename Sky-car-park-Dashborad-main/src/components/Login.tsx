// ─────────────────────────────────────────────────────────────────────────────
// src/components/Login.tsx
// เพิ่ม: "จดจำฉัน" — บันทึก credentials ลง localStorage และ auto-fill
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { LockClosedIcon, UserIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const REMEMBER_KEY = 'sky_remember';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [remember, setRemember]       = useState(false);
  const [showPw,   setShowPw]         = useState(false);
  const [error,    setError]          = useState('');
  const [loading,  setLoading]        = useState(false);

  // ─── Load saved credentials on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { username: u, password: p } = JSON.parse(saved);
        setUsername(u ?? '');
        setPassword(p ?? '');
        setRemember(true);
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const success = login(username.trim(), password, remember);
      if (!success) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setLoading(false);
      } else {
        // Save or clear remember-me credentials
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: username.trim(), password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-lg border border-slate-100">
        {/* Header */}
        <div>
          <div className="mx-auto h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md shadow-blue-200">
            <LockClosedIcon className="h-8 w-8" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900">Sky Car Park Admin</h2>
          <p className="mt-2 text-center text-sm text-slate-500">Sign in to manage your parking</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all bg-slate-50 focus:bg-white"
                placeholder="admin / manager"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                name="password"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="appearance-none block w-full pl-10 pr-10 py-3 border border-slate-300 placeholder-slate-400 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all bg-slate-50 focus:bg-white"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {/* Show/Hide password toggle */}
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPw
                  ? <EyeSlashIcon className="h-4 w-4" />
                  : <EyeIcon className="h-4 w-4" />
                }
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <div className="relative">
                <input
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  remember
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-slate-300 group-hover:border-blue-400'
                }`}>
                  {remember && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-600 font-medium">จดจำฉัน</span>
              {remember && (
                <span className="text-[11px] text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                  บันทึกแล้ว ✓
                </span>
              )}
            </label>
            {remember && (
              <button
                type="button"
                onClick={() => {
                  setRemember(false);
                  localStorage.removeItem(REMEMBER_KEY);
                  localStorage.removeItem('sky_session');
                }}
                className="text-xs text-red-400 hover:text-red-600 underline transition-colors"
              >
                ลืมออก
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2.5 px-4 rounded-xl border border-red-100 flex items-center justify-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white transition-all shadow-md active:scale-95 ${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">© 2026 Sky Car Park Management System</p>
        </div>
      </div>
    </div>
  );
};