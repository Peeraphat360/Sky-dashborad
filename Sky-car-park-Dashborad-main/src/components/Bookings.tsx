import React, { useState } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  BanknotesIcon,
  QrCodeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { Booking, Language, ParkingSlot } from '../types';
import { translations } from '../data/i18n';
import { AddBookingModal } from './AddBookingModal';
import { CustomerAvatar } from './CustomerAvatar';
import { calcFee, FeeBreakdown, NOW } from '../data/mockData';
import { usePermissions } from '../context/AuthContext';

interface BookingsProps {
  bookings: Booking[];
  slots: ParkingSlot[];
  lang: Language;
  onMarkPaid: (id: string, method?: 'cash' | 'transfer', finalAmount?: number, couponCode?: string) => void;
  onCancel: (id: string) => void;
  onAdd: (booking: Booking) => void;
  onEdit?: (booking: Booking) => void;
  onDelete?: (id: string) => void;
  onCheckIn?: (id: string) => void;
  onConfirmPending?: (id: string) => void;
}

function formatDate(d: Date, lang: Language) {
  if (lang === 'th') {
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function getDuration(checkIn: Date, checkOut: Date, lang: Language) {
  const diff = checkOut.getTime() - checkIn.getTime();
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const t = lang === 'th' ? { d: 'วัน', h: 'ชม.' } : { d: 'd', h: 'h' };
  return `${days} ${t.d}${hours > 0 ? ` +${hours}${t.h}` : ''}`;
}

function fmtOver(minutes: number, lang: Language) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (lang === 'th') {
    if (h === 0) return `${m} นาที`;
    return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
  }
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Overdue Warning ──────────────────────────────────────────────────────────
const OverdueWarning: React.FC<{ fb: FeeBreakdown; lang: Language }> = ({ fb, lang }) => {
  if (fb.overCategory === 'none') return null;
  const isGrace   = fb.overCategory === 'grace';
  const isPartial = fb.overCategory === 'partial';
  const icon = isGrace
    ? <ClockIcon className="w-4 h-4 flex-shrink-0 text-yellow-600" />
    : <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />;
  const title = (() => {
    if (lang === 'th') {
      if (isGrace)   return `เกินเวลา ${fmtOver(fb.overMinutes, lang)} — อยู่ในช่วงผ่อนผัน 2 ชม. ไม่คิดเพิ่ม`;
      if (isPartial) return `เกินเวลา ${fmtOver(fb.overMinutes, lang)} — คิด ×1.5`;
      return         `เกินเวลา ${fmtOver(fb.overMinutes, lang)} — คิดเพิ่ม 1 วัน`;
    } else {
      if (isGrace)   return `Overdue ${fmtOver(fb.overMinutes, lang)} — within 2h grace, no extra charge`;
      if (isPartial) return `Overdue ${fmtOver(fb.overMinutes, lang)} — charged ×1.5`;
      return         `Overdue ${fmtOver(fb.overMinutes, lang)} — charged +1 day`;
    }
  })();
  return (
    <div className={`rounded-xl border px-3 py-2.5 mb-3 ${isGrace ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-start gap-2">
        {icon}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${isGrace ? 'text-yellow-700' : 'text-red-700'}`}>{title}</p>
          {!isGrace && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-red-600/80">
              <span>{lang === 'th' ? 'ค่าจอดเดิม' : 'Base fee'}: <span className="font-semibold text-red-700">฿{fb.baseFee.toLocaleString()}</span></span>
              <span>{lang === 'th' ? 'ค่าปรับ' : 'Surcharge'}: <span className="font-semibold text-red-700">+฿{fb.surcharge.toLocaleString()}</span></span>
              <span className="font-bold text-red-700">{lang === 'th' ? 'รวม' : 'Total'}: ฿{fb.totalFee.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Payment Modal ─────────────────────────────────────────────────────────────
interface PaymentModalProps {
  booking: Booking;
  feeBreakdown: FeeBreakdown;
  lang: Language;
  onConfirm: (method: 'cash' | 'transfer', finalAmount: number, couponCode?: string) => void;
  onClose: () => void;
}

const MAX_COUPON_DISCOUNT = 10000;

const PaymentModal: React.FC<PaymentModalProps> = ({ booking, feeBreakdown: fb, lang, onConfirm, onClose }) => {
  const isOverdue = fb.overCategory !== 'none' && fb.overCategory !== 'grace';

  // ─── Coupon state & logic ──────────────────────────────────────────
  const [couponInput, setCouponInput] = useState('');

  const originalTotal = fb.totalFee;
  // Accepts "coupon <number>" (case-insensitive), e.g. "coupon 100", "Coupon 250"
  const couponMatch = couponInput.trim().match(/^coupon\s+(\d+)$/i);
  const parsedValue = couponMatch ? parseInt(couponMatch[1], 10) : 0;
  const isInvalidCoupon = couponInput.trim().length > 0 && !couponMatch;
  const exceedsMax = parsedValue > MAX_COUPON_DISCOUNT;
  const discount = Math.min(parsedValue, MAX_COUPON_DISCOUNT);
  const finalTotal = Math.max(0, originalTotal - discount);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">{lang === 'th' ? 'ชำระเงิน & รับรถคืน' : 'Payment & Return'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{booking.vehicle.plate} · {booking.customer.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="px-5 pt-4">
          {isOverdue ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 mb-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{lang === 'th' ? 'ค่าจอดตามสัญญา' : 'Booked fee'}</span>
                <span className="font-medium">฿{fb.baseFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>{lang === 'th' ? 'ค่าปรับจอดเกิน' : 'Overstay surcharge'}</span>
                <span className="font-semibold">+฿{fb.surcharge.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-200 pt-1.5">
                <span>{lang === 'th' ? 'ยอดรวมสุทธิ' : 'Total due'}</span>
                <span>฿{fb.totalFee.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between mb-1">
              <span className="text-sm text-blue-700 font-medium">{lang === 'th' ? 'ยอดชำระ' : 'Amount due'}</span>
              <span className="text-2xl font-bold text-blue-700">฿{fb.totalFee.toLocaleString()}</span>
            </div>
          )}
          {fb.overCategory === 'grace' && (
            <p className="text-[10px] text-slate-500 mb-3 px-1">
              {lang === 'th'
                ? `เกิน ${fmtOver(fb.overMinutes, lang)} แต่อยู่ในช่วงผ่อนผัน — ไม่คิดเพิ่ม`
                : `${fmtOver(fb.overMinutes, lang)} over but within grace period — no extra charge`}
            </p>
          )}

          {/* Coupon */}
          <div className="mt-3">
            <label className="text-xs text-slate-500 font-medium mb-1 block">
              {lang === 'th' ? 'รหัสคูปองส่วนลด' : 'Discount coupon'}
            </label>
            <input
              type="text"
              value={couponInput}
              onChange={e => setCouponInput(e.target.value)}
              placeholder={lang === 'th' ? 'กรอกรหัสคูปอง (ถ้ามี)' : 'Enter coupon code (optional)'}
              className="input-field w-full"
            />
            {isInvalidCoupon && (
              <p className="text-[10px] text-red-500 mt-1 px-1">
                {lang === 'th' ? 'รหัสคูปองไม่ถูกต้อง (ตัวอย่าง: coupon 100)' : 'Invalid coupon code (e.g. coupon 100)'}
              </p>
            )}
            {exceedsMax && (
              <p className="text-[10px] text-amber-600 mt-1 px-1">
                {lang === 'th'
                  ? 'ส่วนลดสูงสุด ฿10,000 — ระบบปรับให้เป็นยอดสูงสุดแล้ว'
                  : 'Max discount is ฿10,000 — capped automatically'}
              </p>
            )}
            {discount > 0 && (
              <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{lang === 'th' ? 'ยอดเดิม' : 'Original'}</span>
                  <span className="font-medium">฿{originalTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600">
                  <span>{lang === 'th' ? 'ส่วนลด' : 'Discount'}</span>
                  <span className="font-semibold">-฿{discount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-emerald-700 border-t border-emerald-200 pt-1.5">
                  <span>{lang === 'th' ? 'ยอดรวมสุทธิหลังหักส่วนลด' : 'Final total'}</span>
                  <span>฿{finalTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3 pt-3">
          <p className="text-xs text-slate-500 font-medium">{lang === 'th' ? 'เลือกช่องทางการชำระเงิน' : 'Select payment method'}</p>
          <button
            onClick={() => onConfirm('cash', finalTotal, couponInput.trim() || undefined)}
            className="w-full flex items-center gap-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 p-3.5 rounded-xl font-semibold transition-colors border border-emerald-200"
          >
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <BanknotesIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{lang === 'th' ? 'เงินสด' : 'Cash'}</p>
              <p className="text-xs font-normal opacity-70">{lang === 'th' ? 'รับเงินสดจากลูกค้า' : 'Receive cash from customer'}</p>
            </div>
          </button>
          <button
            onClick={() => onConfirm('transfer', finalTotal, couponInput.trim() || undefined)}
            className="w-full flex items-center gap-3 bg-blue-50 text-blue-700 hover:bg-blue-100 p-3.5 rounded-xl font-semibold transition-colors border border-blue-200"
          >
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <QrCodeIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{lang === 'th' ? 'โอนเงิน' : 'Bank Transfer'}</p>
              <p className="text-xs font-normal opacity-70">{lang === 'th' ? 'รับโอนผ่าน QR / PromptPay' : 'QR code / PromptPay transfer'}</p>
            </div>
          </button>
          <button
            onClick={onClose}
            className="w-full p-3 text-slate-500 hover:bg-slate-50 rounded-xl font-medium transition-colors text-sm"
          >
            {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

const zoneColors: Record<string, string> = {
  A1: 'bg-purple-600',
  A2: 'bg-blue-600',
  B:  'bg-sky-600',
  C:  'bg-teal-600',
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Bookings: React.FC<BookingsProps> = ({
  bookings, slots, lang, onMarkPaid, onCancel, onAdd, onEdit, onCheckIn, onConfirmPending,
}) => {
  const t = translations[lang];
  // ✅ ดึง permissions จาก context
  const permissions = usePermissions();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [confirmCheckInId, setConfirmCheckInId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmPendingId, setConfirmPendingId] = useState<string | null>(null);
  const [bookingFilter, setBookingFilter] = useState<'confirmed' | 'pending'>('confirmed');

  // Filter bookings based on status
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const pendingBookings = bookings.filter(b => b.status === 'pending');

  const targetBookings = bookingFilter === 'pending' ? pendingBookings : confirmedBookings;

  const filtered = targetBookings.filter(b => {
    const q = search.toLowerCase();
    if (!q) return true;
    return b.vehicle.plate.toLowerCase().includes(q) ||
      b.customer.name.toLowerCase().includes(q) ||
      b.customer.phone.includes(q) ||
      (!!b.customer.altPhone && b.customer.altPhone.includes(q)) ||
      b.vehicle.model.toLowerCase().includes(q);
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mt-12 md:mt-0 gap-3 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">{t.booking.title}</h1>
          </div>
          <p className="text-sm text-slate-400 mt-2">
            {filtered.length} {lang === 'th'
              ? (bookingFilter === 'pending' ? 'รายการ (รอยืนยัน)' : 'รายการ (รอเช็คอิน)')
              : (bookingFilter === 'pending' ? 'records (awaiting confirmation)' : 'records (awaiting check-in)')}
          </p>
        </div>
        {/* ✅ ซ่อนปุ่มเพิ่มการจองถ้าไม่มีสิทธิ์ — manager มีสิทธิ์เพราะ canAddBooking: true */}
        {permissions.canAddBooking && (
          <button
            onClick={() => setShowModal(true)}
            className="group flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 hover:brightness-105 active:translate-y-0 active:scale-95"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 transition-transform duration-300 group-hover:rotate-90">
              <PlusIcon className="w-3.5 h-3.5" />
            </span>
            <span className="hidden sm:inline">{t.booking.addBooking}</span>
            <span className="sm:hidden">{lang === 'th' ? 'เพิ่ม' : 'Add'}</span>
          </button>
        )}
      </div>

      {/* Toggle Filters */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl max-w-sm">
        <button
          onClick={() => setBookingFilter('confirmed')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl transition-all ${
            bookingFilter === 'confirmed'
              ? 'bg-white text-slate-800 shadow-md shadow-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{lang === 'th' ? 'รอเข้าจอด' : 'Awaiting Check-in'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            bookingFilter === 'confirmed' ? 'bg-slate-100 text-slate-700 font-bold' : 'bg-slate-200 text-slate-600'
          }`}>
            {confirmedBookings.length}
          </span>
        </button>
        <button
          onClick={() => setBookingFilter('pending')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl transition-all relative ${
            bookingFilter === 'pending'
              ? 'bg-white text-slate-800 shadow-md shadow-slate-200/50'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>{lang === 'th' ? 'รอยืนยันออนไลน์' : 'Pending'}</span>
          {pendingBookings.length > 0 ? (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse bg-amber-500 text-white`}>
              {pendingBookings.length}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-600">
              0
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input-field pl-10 w-full"
          placeholder={t.booking.search}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <p>{t.booking.noResults}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {filtered.map(b => {
            const fb = calcFee(b.fee, b.checkIn, b.checkOut, NOW);
            const isPenalty = fb.overCategory === 'partial' || fb.overCategory === 'extra_day';

            return (
              <div key={b.id} className="card p-4 hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl ${zoneColors[b.zone] || 'bg-slate-700'} text-white text-xs font-bold flex items-center justify-center`}>
                      {b.zone}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{lang === 'th' ? 'ช่องจอดที่แนะนำ' : 'Recommended Slot'}</p>
                      <p className="text-sm font-bold text-slate-700">{b.slotNumber.toString().padStart(3,'0')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {b.isWalkIn && (
                      <span className="badge bg-slate-100 text-slate-500 text-[10px]">Walk-in</span>
                    )}
                    <span className={`badge text-xs ${
                      b.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {b.status === 'pending'
                        ? (lang === 'th' ? '● รอยืนยัน' : '● Pending')
                        : (lang === 'th' ? '● จองแล้ว' : '● Reserved')}
                    </span>
                  </div>
                </div>

                {/* Booking Ref */}
                <div className="mb-2">
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Booking No: {b.id}</span>
                </div>

                {/* Customer */}
                <div className="mb-3 flex items-center gap-2.5">
                  <CustomerAvatar name={b.customer.name} pictureUrl={b.customer.pictureUrl} className="w-9 h-9 rounded-full text-sm" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{b.customer.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {b.customer.phone}{b.customer.altPhone ? ` · ${b.customer.altPhone}` : ''}
                    </p>
                  </div>
                </div>

                {/* Plate */}
                <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg mb-3">
                  <span>{b.vehicle.plate}</span>
                  <span className="text-slate-700 font-normal">{b.vehicle.province}</span>
                </div>

                {/* Dates */}
                <div className="text-sm md:text-xs space-y-1 text-slate-500 mb-3">
                  <div className="flex justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                    <span>{t.booking.bookedAt}</span>
                    <span className="font-medium text-slate-700">{formatDate(b.createdAt, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.booking.checkIn}</span>
                    <span className="font-medium text-slate-700">{formatDate(b.checkIn, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.booking.checkOut}</span>
                    <span className="font-medium text-slate-700">{formatDate(b.checkOut, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.booking.duration}</span>
                    <span className="font-medium text-slate-700">{getDuration(b.checkIn, b.checkOut, lang)}</span>
                  </div>
                </div>

                {/* Vehicle */}
                <p className="text-xs text-slate-400 mb-3">{b.vehicle.brand} {b.vehicle.model}</p>

                {/* Remarks */}
                {b.remarks && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl mb-3">
                    <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-amber-600 mb-0.5">{t.booking.remarks}</p>
                      <p className="text-xs text-amber-800 break-words">{b.remarks}</p>
                    </div>
                  </div>
                )}

                {/* Overdue warning */}
                <OverdueWarning fb={fb} lang={lang} />

                {/* Fee */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mb-3">
                  <div>
                    <span className="text-xs text-slate-400">{t.booking.fee}</span>
                    {isPenalty && (
                      <p className="text-[10px] text-slate-400 line-through">฿{fb.baseFee.toLocaleString()}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-blue-600">฿{fb.totalFee.toLocaleString()}</span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {b.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => setConfirmPendingId(b.id)}
                        className="flex-1 justify-center text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        {lang === 'th' ? 'ยืนยันการจอง' : 'Confirm'}
                      </button>
                      {permissions.canEditBooking && (
                        <button onClick={() => setEditingBooking(b)} className="btn-secondary px-4 text-xs font-medium">
                          {t.booking.edit}
                        </button>
                      )}
                      {permissions.canCancelBooking && (
                        <button
                          onClick={() => setConfirmCancelId(b.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <NoSymbolIcon className="w-3.5 h-3.5" />
                          {lang === 'th' ? 'ปฏิเสธ' : 'Reject'}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ✅ Check In */}
                      {permissions.canCheckIn && (
                        <button
                          onClick={() => setConfirmCheckInId(b.id)}
                          className="flex-1 justify-center text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          {lang === 'th' ? 'มาจอดแล้ว' : 'Check In'}
                        </button>
                      )}
                      {/* ✅ Edit */}
                      {permissions.canEditBooking && (
                        <button onClick={() => setEditingBooking(b)} className="btn-secondary px-4 text-xs font-medium">
                          {t.booking.edit}
                        </button>
                      )}
                      {/* ✅ Cancel */}
                      {permissions.canCancelBooking && (
                        <button
                          onClick={() => setConfirmCancelId(b.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
                        >
                          <NoSymbolIcon className="w-3.5 h-3.5" />
                          {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {(showModal || editingBooking) && (
        <AddBookingModal
          onClose={() => { setShowModal(false); setEditingBooking(null); }}
          onAdd={onAdd}
          onEdit={onEdit}
          slots={slots}
          bookings={bookings}
          lang={lang}
          editingBooking={editingBooking}
        />
      )}

      {paymentBooking && (
        <PaymentModal
          booking={paymentBooking}
          feeBreakdown={calcFee(paymentBooking.fee, paymentBooking.checkIn, paymentBooking.checkOut, NOW)}
          lang={lang}
          onConfirm={(method, finalAmount, couponCode) => {
            onMarkPaid(paymentBooking.id, method, finalAmount, couponCode);
            setPaymentBooking(null);
          }}
          onClose={() => setPaymentBooking(null)}
        />
      )}

      {/* Check-in Confirmation Modal */}
      {confirmCheckInId && (() => {
        const checkInBooking = bookings.find(b => b.id === confirmCheckInId);
        if (!checkInBooking) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{lang === 'th' ? 'ยืนยันการนำรถเข้าจอด' : 'Confirm Check-in'}</h3>
                  </div>
                </div>
                <button onClick={() => setConfirmCheckInId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-slate-600 text-center">
                  {lang === 'th' ? (
                    <>คุณต้องการยืนยันการนำรถทะเบียน <span className="font-bold text-sky-700 bg-sky-400/50 p-1 rounded-xl">{checkInBooking.vehicle.plate}</span> เข้าจอดใช่หรือไม่?</>
                  ) : (
                    <>Are you sure you want to check in vehicle with plate <span className="font-bold text-sky-700 bg-sky-400/50 p-1 rounded-xl">{checkInBooking.vehicle.plate}</span>?</>
                  )}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmCheckInId(null)} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button onClick={() => { onCheckIn?.(checkInBooking.id); setConfirmCheckInId(null); }} className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20">
                    {lang === 'th' ? 'ยืนยัน' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Cancel Confirmation Modal */}
      {confirmCancelId && (() => {
        const cancelBooking = bookings.find(b => b.id === confirmCancelId);
        if (!cancelBooking) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <NoSymbolIcon className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{lang === 'th' ? 'ยืนยันการยกเลิกการจอง' : 'Confirm Cancellation'}</h3>
                  </div>
                </div>
                <button onClick={() => setConfirmCancelId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <p className="text-sm text-slate-600 text-center">
                  {lang === 'th' ? (
                    <>คุณต้องการยกเลิกการจองของรถทะเบียน <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{cancelBooking.vehicle.plate}</span> ใช่หรือไม่?</>
                  ) : (
                    <>Are you sure you want to cancel the booking for plate <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">{cancelBooking.vehicle.plate}</span>?</>
                  )}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmCancelId(null)} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    {lang === 'th' ? 'ปิด' : 'Close'}
                  </button>
                  <button onClick={() => { onCancel(cancelBooking.id); setConfirmCancelId(null); }} className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20">
                    {lang === 'th' ? 'ยืนยันการยกเลิก' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending Confirmation Modal */}
      {confirmPendingId && (() => {
        const pendingBooking = bookings.find(b => b.id === confirmPendingId);
        if (!pendingBooking) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{lang === 'th' ? 'ยืนยันการจองออนไลน์' : 'Confirm Online Booking'}</h3>
                  </div>
                </div>
                <button onClick={() => setConfirmPendingId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                <div className="text-sm text-slate-600 space-y-2">
                  <p className="text-center">
                    {lang === 'th' ? (
                      <>คุณต้องการยืนยันการจองของลูกค้า <span className="font-bold text-slate-800">{pendingBooking.customer.name}</span> ใช่หรือไม่?</>
                    ) : (
                      <>Are you sure you want to confirm the booking for <span className="font-bold text-slate-800">{pendingBooking.customer.name}</span>?</>
                    )}
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{lang === 'th' ? 'ทะเบียนรถ' : 'License Plate'}</span>
                      <span className="font-bold text-slate-700">{pendingBooking.vehicle.plate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{lang === 'th' ? 'ช่องจอดที่ระบุ' : 'Assigned Slot'}</span>
                      <span className="font-bold text-sky-700">Zone {pendingBooking.zone} - ช่อง {pendingBooking.slotNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{lang === 'th' ? 'วันเวลาเข้าจอด' : 'Check-in'}</span>
                      <span className="font-medium text-slate-700">{formatDate(pendingBooking.checkIn, lang)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{lang === 'th' ? 'ค่าจอดสุทธิ' : 'Fee'}</span>
                      <span className="font-bold text-emerald-600">฿{pendingBooking.fee.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmPendingId(null)} className="flex-1 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                    {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
                  </button>
                  <button onClick={() => { onConfirmPending?.(pendingBooking.id); setConfirmPendingId(null); }} className="flex-1 py-2.5 text-sm font-bold rounded-xl transition-all bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
                    {lang === 'th' ? 'ยืนยันการจอง' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};