// ─────────────────────────────────────────────────────────────────────────────
// src/components/Sidebar.tsx  (แก้ไขจากของเดิม)
// เพิ่ม: กรอง navItems ตาม permissions.tabs + แสดง role badge
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  Squares2X2Icon,
  CalendarDaysIcon,
  ClockIcon,
  BanknotesIcon,
  GlobeAltIcon,
  TruckIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { TabId, Language, Booking, ParkingSlot } from '../types';
import { translations } from '../data/i18n';
import { useAuth, usePermissions } from '../context/AuthContext';
import logo from '../assets/logo.png';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  bookings: Booking[];
  slots: ParkingSlot[];
}

const ALL_NAV_ITEMS: { id: TabId; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', icon: Squares2X2Icon },
  { id: 'bookings',  icon: CalendarDaysIcon },
  { id: 'parking',   icon: TruckIcon },
  { id: 'history',   icon: ClockIcon },
  { id: 'revenue',   icon: BanknotesIcon },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, lang, setLang, bookings, slots,
}) => {
  const t = translations[lang];
  const { user, logout } = useAuth();
  const permissions = usePermissions();

  // กรองแค่ tab ที่มีสิทธิ์
  const navItems = ALL_NAV_ITEMS.filter(item => permissions.tabs.includes(item.id));

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;

  // ─── Realtime slot count with pulse ─────────────────────────────────
  const totalSlots = slots.length;
  const availableSlots = slots.filter(s => s.status === 'available').length;
  const [slotPulse, setSlotPulse] = useState(false);
  const prevAvailRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevAvailRef.current !== null && prevAvailRef.current !== availableSlots) {
      setSlotPulse(true);
      setTimeout(() => setSlotPulse(false), 1800);
    }
    prevAvailRef.current = availableSlots;
  }, [availableSlots]);

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-60 bg-white border-r border-slate-100 flex-col shadow-sm z-30">
        {/* Logo */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-14 h-14 object-contain" />
            <div>
              <div className="font-bold text-slate-800 text-sm leading-tight">{t.appName}</div>
              <div className="text-[10px] text-slate-400 font-medium">{t.appSubtitle}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`sidebar-item w-full ${activeTab === id ? 'sidebar-item-active' : 'sidebar-item-inactive'}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{t.nav[id]}</span>
              {id === 'bookings' && (confirmedCount > 0 || pendingCount > 0) ? (
                <div className="ml-auto flex items-center gap-1">
                  {pendingCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-amber-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {confirmedCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-blue-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                      {confirmedCount > 99 ? '99+' : confirmedCount}
                    </span>
                  )}
                </div>
              ) : activeTab === id ? (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
              ) : null}
            </button>
          ))}
        </nav>

        {/* Language & Logout */}
        <div className="px-3 space-y-1 pb-4">
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="sidebar-item w-full text-slate-500 hover:text-blue-600 hover:bg-blue-50"
          >
            <GlobeAltIcon className="w-5 h-5" />
            <span>{t.common.language}</span>
          </button>
          <button
            onClick={logout}
            className="sidebar-item w-full text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>{t.common.logout}</span>
          </button>
        </div>

        {/* Realtime slot status */}
        {totalSlots > 0 && (
          <div className={`mx-3 mb-3 rounded-xl p-3 border transition-all duration-500 ${
            slotPulse
              ? 'bg-emerald-50 border-emerald-300 shadow-sm shadow-emerald-100'
              : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'th' ? 'ช่องจอดรถ' : 'Parking Slots'}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  style={{ animation: 'livePulse 1.4s ease-in-out infinite' }}
                />
                LIVE
              </span>
            </div>
            <div className="flex items-end gap-1">
              <span
                className={`text-2xl font-bold leading-none transition-colors duration-500 ${
                  slotPulse ? 'text-emerald-600' : 'text-slate-700'
                }`}
              >
                {availableSlots}
              </span>
              <span className="text-xs text-slate-400 mb-0.5">/ {totalSlots}</span>
            </div>
            <p className={`text-[11px] mt-1 font-medium transition-colors duration-500 ${
              slotPulse ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {lang === 'th' ? 'ว่าง' : 'Available'}
            </p>
            {/* Mini progress bar */}
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  availableSlots / totalSlots > 0.5 ? 'bg-emerald-400' :
                  availableSlots / totalSlots > 0.2 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${(availableSlots / totalSlots) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* User footer */}
        <div className="px-5 py-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
              {user?.displayName.charAt(0) ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <div className="text-xs font-semibold text-slate-700 truncate">{user?.displayName}</div>
              </div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
        </div>
      </aside>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      {/* ── Mobile Top Bar ──────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-sm">{t.appName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <GlobeAltIcon className="w-5 h-5" />
            </button>
            <button
              onClick={logout}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 shadow-lg">
        <div className="flex relative">
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                activeTab === id ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {id === 'bookings' && (pendingCount > 0 || confirmedCount > 0) && (
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`} />
                )}
              </div>
              <span className="text-[10px] font-medium">{t.nav[id]}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
};