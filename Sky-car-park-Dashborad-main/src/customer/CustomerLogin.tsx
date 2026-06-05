// ─────────────────────────────────────────────────────────────────────────────
// src/customer/CustomerLogin.tsx
// Customer-facing login page. A single "Log in with LINE" button that points at
// the backend /auth/line route — a top-level navigation, because OAuth requires
// a full-page redirect to LINE's consent screen (not fetch/XHR).
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { LINE_LOGIN_URL } from './api';

export const CustomerLogin: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 py-12 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-lg border border-slate-100">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-md shadow-emerald-200 text-2xl">
            🅿️
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">Sky Car Park</h2>
          <p className="mt-2 text-sm text-slate-500">จองที่จอดรถล่วงหน้า — เข้าสู่ระบบด้วย LINE</p>
        </div>

        {/* Log in with LINE */}
        <a
          href={LINE_LOGIN_URL}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl text-white font-semibold text-sm shadow-md transition-all active:scale-95 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#06C755]"
          style={{ backgroundColor: '#06C755' }}
        >
          {/* LINE logo mark */}
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.48 2 2 5.69 2 10.23c0 4.07 3.55 7.48 8.35 8.13.32.07.77.21.88.49.1.25.07.64.03.9l-.14.85c-.04.25-.2.99.87.54 1.07-.45 5.76-3.39 7.86-5.81C21.32 13.66 22 12 22 10.23 22 5.69 17.52 2 12 2zM8.18 12.6H6.2a.53.53 0 0 1-.53-.53V8.1a.53.53 0 0 1 1.06 0v3.44h1.45a.53.53 0 0 1 0 1.06zm2.08-.53a.53.53 0 0 1-1.06 0V8.1a.53.53 0 0 1 1.06 0v3.97zm4.7 0a.53.53 0 0 1-.42.52.53.53 0 0 1-.59-.2l-2.03-2.76v2.44a.53.53 0 0 1-1.06 0V8.1a.53.53 0 0 1 .96-.31l2.04 2.77V8.1a.53.53 0 0 1 1.06 0v3.97zm3.3-2.51a.53.53 0 0 1 0 1.06h-1.45v.92h1.45a.53.53 0 0 1 0 1.06h-1.98a.53.53 0 0 1-.53-.53V8.1a.53.53 0 0 1 .53-.53h1.98a.53.53 0 0 1 0 1.06h-1.45v.92h1.45z" />
          </svg>
          Log in with LINE
        </a>

        <p className="text-center text-xs text-slate-400 leading-relaxed">
          เราจะใช้เฉพาะชื่อโปรไฟล์ LINE ของคุณเท่านั้น<br />
          ข้อมูลจะถูกบันทึกก็ต่อเมื่อคุณยืนยันการจองเท่านั้น
        </p>

        <div className="text-center">
          <p className="text-xs text-slate-400">© 2026 Sky Car Park</p>
        </div>
      </div>
    </div>
  );
};
