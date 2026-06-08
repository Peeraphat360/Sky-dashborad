import React, { useState, useEffect, useRef } from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import {
  SquaresPlusIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  QrCodeIcon,
  XMarkIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Booking, Language, ParkingSlot } from '../types';
import { translations } from '../data/i18n';
import { usePermissions } from '../context/AuthContext';

interface DashboardProps {
  slots: ParkingSlot[];
  bookings: Booking[];
  lang: Language;
  onMoveBooking?: (bookingId: string, newSlotId: string) => void;
}

// ─── Static fallback week data (used when no real data available) ─────────────
const FALLBACK_WEEK = [
  { day: 'จ', dayEn: 'Mon', checkIn: 8,  checkOut: 5,  cancelled: 1 },
  { day: 'อ', dayEn: 'Tue', checkIn: 11, checkOut: 7,  cancelled: 2 },
  { day: 'พ', dayEn: 'Wed', checkIn: 6,  checkOut: 9,  cancelled: 0 },
  { day: 'พฤ', dayEn: 'Thu', checkIn: 14, checkOut: 10, cancelled: 1 },
  { day: 'ศ', dayEn: 'Fri', checkIn: 17, checkOut: 13, cancelled: 3 },
  { day: 'ส', dayEn: 'Sat', checkIn: 12, checkOut: 8,  cancelled: 2 },
  { day: 'อา', dayEn: 'Sun', checkIn: 9,  checkOut: 11, cancelled: 1 },
];

const DAY_LABELS_TH  = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAY_LABELS_EN  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildWeekData(bookings: Booking[]) {
  // Find the most recent 7-day window that has any data
  const sorted = [...bookings].filter(b => b.checkIn).sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
  const refDate = sorted.length > 0 ? new Date(sorted[0].checkIn) : new Date();

  // Build Mon–Sun of the week containing refDate
  const dow = refDate.getDay(); // 0=Sun
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const result = days.map((d, i) => {
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const checkIn   = bookings.filter(b => b.status !== 'cancelled' && b.checkIn  >= d && b.checkIn  < next).length;
    const checkOut  = bookings.filter(b => b.status === 'completed'  && b.checkOut >= d && b.checkOut < next).length;
    const cancelled = bookings.filter(b => b.status === 'cancelled'  && b.createdAt >= d && b.createdAt < next).length;
    return { day: DAY_LABELS_TH[i === 6 ? 0 : i + 1], dayEn: DAY_LABELS_EN[i === 6 ? 0 : i + 1], checkIn, checkOut, cancelled };
  });

  // If all zeros, use fallback simulated data
  const hasData = result.some(r => r.checkIn > 0 || r.checkOut > 0 || r.cancelled > 0);
  return hasData ? result : FALLBACK_WEEK;
}

// ─── New/Returning customer detection ─────────────────────────────────────────
function calcCustomerTypes(bookings: Booking[]) {
  const completed = bookings.filter(b => b.status === 'completed');
  // Group by customer name (as specified)
  const visitCount = new Map<string, number>();
  completed.forEach(b => {
    const name = b.customer.name.trim();
    visitCount.set(name, (visitCount.get(name) ?? 0) + 1);
  });
  // Also consider active/confirmed as customers
  const allNames = new Set<string>();
  bookings.forEach(b => allNames.add(b.customer.name.trim()));

  let newCount = 0, returningCount = 0;
  allNames.forEach(name => {
    if ((visitCount.get(name) ?? 0) >= 2) returningCount++;
    else newCount++;
  });
  const total = newCount + returningCount;
  return {
    newCount,
    returningCount,
    newPct:       total > 0 ? Math.round((newCount / total) * 100)       : 0,
    returningPct: total > 0 ? Math.round((returningCount / total) * 100) : 0,
    total,
  };
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
interface DonutChartProps {
  newPct: number;
  returningPct: number;
  newCount: number;
  returningCount: number;
  lang: Language;
}

const DonutChart: React.FC<DonutChartProps> = ({ newPct, returningPct, newCount, returningCount, lang }) => {
  const r = 52, cx = 70, cy = 70, stroke = 14;
  const circ = 2 * Math.PI * r;
  // new = green (starts at top), returning = purple
  const newDash  = (newPct / 100) * circ;
  const retDash  = (returningPct / 100) * circ;
  const gap = 3;
  const retOffset = -(newDash + gap);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {/* Returning (purple) */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#8b5cf6" strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, retDash - gap)} ${circ}`}
          strokeDashoffset={retOffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* New (green) */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="#10b981" strokeWidth={stroke}
          strokeDasharray={`${Math.max(0, newDash - gap)} ${circ}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease' }}
        />
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#1e293b" fontSize={18} fontWeight={700}>{newPct + returningPct > 0 ? `${newCount + returningCount}` : '0'}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fill="#94a3b8" fontSize={10}>{lang === 'th' ? 'ลูกค้า' : 'customers'}</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{lang === 'th' ? 'ลูกค้าใหม่' : 'New'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{newPct}%</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{newCount} {lang === 'th' ? 'คน' : 'ppl'}</span>
          </div>
        </div>
        <div style={{ width: '80%', height: 1, background: '#f1f5f9' }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{lang === 'th' ? 'ลูกค้าเก่า' : 'Returning'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>{returningPct}%</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{returningCount} {lang === 'th' ? 'คน' : 'ppl'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SLOT_STATUS_COLORS = {
  available: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  occupied:  { bg: 'bg-red-100',     border: 'border-red-300',     text: 'text-red-700',     dot: 'bg-red-400' },
  reserved:  { bg: 'bg-amber-100',   border: 'border-amber-300',   text: 'text-amber-700',   dot: 'bg-amber-400' },
};

// Normalize any status value from DB (handles uppercase, unknown, etc.)
function normalizeStatus(raw: string): 'available' | 'occupied' | 'reserved' {
  const s = (raw ?? '').toLowerCase();
  if (s === 'occupied')  return 'occupied';
  if (s === 'reserved')  return 'reserved';
  return 'available'; // default to available for AVAILABLE or unknown
}

// ─── Move Slot Popup ──────────────────────────────────────────────────────────
interface MoveSlotPopupProps {
  targetSlot: ParkingSlot;
  slots: ParkingSlot[];
  bookings: Booking[];
  lang: Language;
  onClose: () => void;
  onMove: (bookingId: string, newSlotId: string) => void;
}

const MoveSlotPopup: React.FC<MoveSlotPopupProps> = ({ targetSlot, slots, bookings, lang, onClose, onMove }) => {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Find all active bookings that can be moved
  const movableBookings = bookings
    .filter(b => b.status === 'active')
    .map(b => {
      const slot = slots.find(s => s.id === b.slotId);
      return { booking: b, slot };
    })
    .filter(({ slot }) => slot && slot.id !== targetSlot.id);

  const zoneHeaderBg: Record<string, string> = {
    A1: 'bg-purple-600',
    A2: 'bg-blue-600',
    B: 'bg-sky-600',
    C: 'bg-teal-600',
  };

  const handleConfirmMove = () => {
    if (!selectedBookingId) return;
    onMove(selectedBookingId, targetSlot.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {lang === 'th' ? 'ย้ายรถมาช่องนี้' : 'Move Vehicle to This Slot'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg text-white ${zoneHeaderBg[targetSlot.zone]}`}>
                Zone {targetSlot.zone}
              </span>
              <span className="text-xs text-slate-500">
                {lang === 'th' ? 'ช่องที่' : 'Slot'} {targetSlot.number}
              </span>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                {lang === 'th' ? '● ว่าง' : '● Available'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {movableBookings.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              {lang === 'th' ? 'ไม่มีรถที่สามารถย้ายได้ในขณะนี้' : 'No vehicles available to move right now'}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium mb-3">
                {lang === 'th'
                  ? 'เลือกรถที่ต้องการย้ายมายังช่องนี้'
                  : 'Select a vehicle to move into this slot'}
              </p>
              {movableBookings.map(({ booking: b, slot }) => {
                const isSelected = selectedBookingId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBookingId(isSelected ? null : b.id)}
                    className={`w-full text-left rounded-xl border-2 p-3.5 transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Zone badge */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white text-[10px] font-bold ${zoneHeaderBg[slot?.zone || 'B']}`}>
                        <span>{slot?.zone}</span>
                        <span className="text-[9px] opacity-80">#{slot?.number}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-800 truncate">{b.customer.name}</span>
                          {b.status === 'confirmed' ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                              {lang === 'th' ? 'จองแล้ว' : 'Reserved'}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                              {lang === 'th' ? 'กำลังจอด' : 'Parked'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b.vehicle.plate} · {b.vehicle.brand} {b.vehicle.model}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{b.customer.phone}</p>
                      </div>

                      {/* Check */}
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {movableBookings.length > 0 && (
          <div className="p-5 border-t border-slate-100 flex-shrink-0 space-y-3">
            {/* Preview */}
            {selectedBookingId && (() => {
              const found = movableBookings.find(x => x.booking.id === selectedBookingId);
              if (!found) return null;
              return (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
                  <span className={`font-bold px-2 py-0.5 rounded-lg text-white text-[10px] ${zoneHeaderBg[found.slot?.zone || 'B']}`}>
                    {found.slot?.zone}-{found.slot?.number}
                  </span>
                  <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className={`font-bold px-2 py-0.5 rounded-lg text-white text-[10px] ${zoneHeaderBg[targetSlot.zone]}`}>
                    {targetSlot.zone}-{targetSlot.number}
                  </span>
                  <span className="text-slate-500 truncate">{found.booking.customer.name}</span>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmMove}
                disabled={!selectedBookingId}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                  selectedBookingId
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {lang === 'th' ? 'ยืนยันการย้าย' : 'Confirm Move'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Zone Map ─────────────────────────────────────────────────────────────────
interface ZoneMapProps {
  slots: ParkingSlot[];
  bookings: Booking[];
  lang: Language;
  canMoveSlot: boolean;
  onSlotClick: (slot: ParkingSlot) => void;
}

const ZoneMap: React.FC<ZoneMapProps> = ({ slots, bookings, lang, canMoveSlot, onSlotClick }) => {
  const t = translations[lang];
  const zones = ['A1', 'A2', 'B', 'C'] as const;
  const zoneLabels = {
    A1: t.dashboard.zoneA1,
    A2: t.dashboard.zoneA2,
    B: t.dashboard.zoneB,
    C: t.dashboard.zoneC,
  };
  const zoneColors = {
    A1: 'from-purple-50 to-purple-100 border-purple-200',
    A2: 'from-blue-50 to-blue-100 border-blue-200',
    B: 'from-sky-50 to-sky-100 border-sky-200',
    C: 'from-teal-50 to-teal-100 border-teal-200',
  };
  const zoneHeaderColors = {
    A1: 'bg-purple-600',
    A2: 'bg-blue-600',
    B: 'bg-sky-600',
    C: 'bg-teal-600',
  };

  // ─── Show empty state while loading from Supabase ─────────────────────
  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
        <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm">{lang === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading slots...'}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {zones.map(zone => {
        const zoneSlots = slots.filter(s => s.zone === zone);
        // Normalize all statuses before counting
        const normalizedSlots = zoneSlots.map(s => ({
          ...s,
          status: normalizeStatus(s.status),
        }));
        const avail    = normalizedSlots.filter(s => s.status === 'available').length;
        const occupied = normalizedSlots.filter(s => s.status === 'occupied').length;
        const reserved = normalizedSlots.filter(s => s.status === 'reserved').length;

        return (
          <div key={zone} className={`rounded-xl border bg-gradient-to-br ${zoneColors[zone]} p-3`}>
            <div className="flex items-center mb-2">
              <div className={`text-white text-xs font-bold px-2.5 py-1 rounded-lg ${zoneHeaderColors[zone]}`}>{zone}</div>
            </div>
            <p className="text-[10px] text-slate-500 mb-2 leading-tight">{zoneLabels[zone]}</p>
            <div className="flex flex-wrap gap-1">
              {normalizedSlots.map(slot => {
                const colors = SLOT_STATUS_COLORS[slot.status];
                const isAvailable = slot.status === 'available';

                // Find booking for this slot to show tooltip
                const slotBooking = bookings.find(b => b.slotId === slot.id && (b.status === 'active' || b.status === 'confirmed'));
                const statusLabel = slot.status === 'available'
                  ? (lang === 'th' ? 'ว่าง' : 'Available')
                  : slot.status === 'occupied'
                  ? (lang === 'th' ? 'ไม่ว่าง' : 'Occupied')
                  : (lang === 'th' ? 'จองแล้ว' : 'Reserved');
                const tooltipText = slotBooking
                  ? `ช่อง ${slot.number} — ${slotBooking.customer.name} | ${slotBooking.vehicle.plate}`
                  : `ช่อง ${slot.number} — ${statusLabel}`;

                return (
                  <div
                    key={slot.id}
                    title={tooltipText}
                    onClick={() => isAvailable && onSlotClick(slot)}
                    className={`w-8 h-7 rounded border ${colors.bg} ${colors.border} flex items-center justify-center transition-all ${
                      isAvailable && canMoveSlot
                        ? 'cursor-pointer hover:scale-110 hover:shadow-md hover:border-emerald-500 hover:bg-emerald-200 active:scale-95'
                        : 'cursor-default'
                    }`}
                  >
                    <span className={`text-[9px] font-bold ${colors.text}`}>{slot.number}</span>
                  </div>
                );
              })}
            </div>
            {/* สรุปจำนวนช่องของโซน — ย้ายมาล่างการ์ด ทำเป็น pill ให้อ่านง่ายบนมือถือ */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/60 pt-2.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{avail} {lang === 'th' ? 'ว่าง' : 'free'}
              </span>
              {occupied > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{occupied} {lang === 'th' ? 'ไม่ว่าง' : 'full'}
                </span>
              )}
              {reserved > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{reserved} {lang === 'th' ? 'จอง' : 'booked'}
                </span>
              )}
            </div>
            {avail > 0 && canMoveSlot && (
              <p className="text-[9px] text-emerald-600 mt-2 font-medium">
                {lang === 'th' ? '↑ กดช่องว่างเพื่อย้ายรถ' : '↑ Tap available slot to move a vehicle'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const Dashboard: React.FC<DashboardProps> = ({ slots, bookings, lang, onMoveBooking }) => {
  const t = translations[lang];
  // ✅ ต้องเรียก hook ใน component เท่านั้น (Rules of Hooks)
  const permissions = usePermissions();
  const now = new Date();
  const [moveTarget, setMoveTarget] = useState<ParkingSlot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [pulse, setPulse] = useState(false);
  const prevSlotsRef = useRef<string>('');

  // Track when slots change and trigger pulse animation
  useEffect(() => {
    const slotsKey = slots.map(s => `${s.id}:${s.status}`).join(',');
    if (slotsKey !== prevSlotsRef.current && prevSlotsRef.current !== '') {
      setLastUpdated(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
    }
    prevSlotsRef.current = slotsKey;
  }, [slots]);

  // ✅ ถ้าไม่มีสิทธิ์ย้ายช่องจอด ไม่ให้เปิด popup
  const handleSlotClick = (slot: ParkingSlot) => {
    if (permissions.canMoveSlot) setMoveTarget(slot);
  };

  const totalSlots = slots.length;
  const occupied = slots.filter(s => s.status === 'occupied').length;
  const available = slots.filter(s => s.status === 'available').length;
  const occupancyPct = Math.round((occupied / totalSlots) * 100);

  const todayBookings = bookings.filter(b => {
    const d = b.checkIn;
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  const statCards = [
    { label: t.dashboard.totalSlots, value: totalSlots, icon: SquaresPlusIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t.dashboard.occupied, value: occupied, icon: CheckCircleIcon, color: 'text-red-500', bg: 'bg-red-50' },
    { label: t.dashboard.available, value: available, icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: t.dashboard.todayBookings, value: todayBookings, icon: CalendarDaysIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: t.dashboard.occupancyRate, value: `${occupancyPct}%`, icon: SquaresPlusIcon, color: 'text-sky-600', bg: 'bg-sky-50' },
  ];

  const weekData = buildWeekData(bookings);
  const customerTypes = calcCustomerTypes(bookings);

  const recentBookings = [...bookings]
    .filter(b => b.status !== 'completed')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const handleMove = (bookingId: string, newSlotId: string) => {
    if (onMoveBooking) {
      onMoveBooking(bookingId, newSlotId);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className='pt-12 md:pt-0 flex items-start justify-between'>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t.dashboard.title}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Sky Car Park Admin</p>
        </div>
        {/* LIVE badge */}
        <div className="flex flex-col items-end gap-1 mt-1">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
              style={{
                animation: 'livePulse 1.4s ease-in-out infinite',
              }}
            />
            LIVE
          </span>
          <span className={`text-[10px] transition-colors duration-300 ${
            pulse ? 'text-emerald-600 font-semibold' : 'text-slate-400'
          }`}>
            {lang === 'th' ? 'อัพเดทล่าสุด' : 'Updated'}{' '}
            {lastUpdated.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card p-3 md:p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">{card.label}</p>
                <p className={`text-xl md:text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 md:w-5 md:h-5 ${card.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Parking Map */}
        <div className="card p-4 md:p-5 md:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-700 text-sm">{t.dashboard.parkingMap}</h2>
            <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />{t.dashboard.slotAvail}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />{t.dashboard.slotOccupied}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />{lang === 'th' ? 'จองแล้ว' : 'Reserved'}</span>
            </div>
          </div>
          <ZoneMap
            slots={slots}
            bookings={bookings}
            lang={lang}
            canMoveSlot={permissions.canMoveSlot}
            onSlotClick={handleSlotClick}
          />
        </div>

        {/* Right column: Weekly line chart + Donut */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Weekly Activity Line Chart */}
          <div className="card p-4 md:p-5">
            <h2 className="font-bold text-slate-700 text-sm mb-1">{t.dashboard.weeklyOccupancy}</h2>
            <p className="text-[10px] text-slate-400 mb-3">{lang === 'th' ? 'เช็คอิน / เช็คเอาท์ / ยกเลิก' : 'Check-in / Check-out / Cancelled'}</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weekData} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={lang === 'th' ? 'day' : 'dayEn'} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 11, padding: '6px 10px' }}
                  formatter={(val: number, name: string) => {
                    const labels: Record<string, string> = lang === 'th'
                      ? { checkIn: 'เช็คอิน', checkOut: 'เช็คเอาท์', cancelled: 'ยกเลิก' }
                      : { checkIn: 'Check-in', checkOut: 'Check-out', cancelled: 'Cancelled' };
                    return [val, labels[name] ?? name];
                  }}
                />
                <Line type="monotone" dataKey="checkIn"   stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="checkOut"  stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
            {/* Manual legend */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {[
                { color: '#10b981', label: lang === 'th' ? 'เช็คอิน' : 'Check-in' },
                { color: '#8b5cf6', label: lang === 'th' ? 'เช็คเอาท์' : 'Check-out' },
                { color: '#ef4444', label: lang === 'th' ? 'ยกเลิก' : 'Cancelled' },
              ].map(l => (
                <span key={l.color} className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="inline-block w-5 h-0.5 rounded-full" style={{ background: l.color }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* New vs Returning Donut */}
          <div className="card p-4 md:p-5">
            <h2 className="font-bold text-slate-700 text-sm mb-3">
              {lang === 'th' ? 'ลูกค้าใหม่ vs เก่า' : 'New vs Returning'}
            </h2>
            <DonutChart
              newPct={customerTypes.newPct}
              returningPct={customerTypes.returningPct}
              newCount={customerTypes.newCount}
              returningCount={customerTypes.returningCount}
              lang={lang}
            />
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card p-4 md:p-5">
        <h2 className="font-bold text-slate-700 text-sm mb-4">{t.dashboard.recentActivity}</h2>
        <div className="space-y-2">
          {recentBookings.map(b => (
            <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {b.zone}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate">{b.customer.name}</p>
                  <p className="text-xs text-slate-400 truncate">{b.vehicle.plate} · {b.vehicle.brand} {b.vehicle.model}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-bold text-blue-600">฿{b.fee.toLocaleString()}</p>
                <div className="flex flex-col items-end gap-1 mt-1">
                  <span className={`badge text-[10px] ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {b.status === 'active' ? t.booking.statusActive : t.booking.statusConfirmed}
                  </span>
                  {b.paymentMethod && (
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                      b.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      {b.paymentMethod === 'cash' ? <BanknotesIcon className="w-2.5 h-2.5" /> : <QrCodeIcon className="w-2.5 h-2.5" />}
                      {b.paymentMethod === 'cash' ? (lang === 'th' ? 'เงินสด' : 'Cash') : (lang === 'th' ? 'โอน' : 'Transfer')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Move Slot Popup */}
      {moveTarget && (
        <MoveSlotPopup
          targetSlot={moveTarget}
          slots={slots}
          bookings={bookings}
          lang={lang}
          onClose={() => setMoveTarget(null)}
          onMove={handleMove}
        />
      )}
    </div>
  );
};