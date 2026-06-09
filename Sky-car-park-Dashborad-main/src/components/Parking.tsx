// ─────────────────────────────────────────────────────────────────────────────
// src/components/Parking.tsx  (แก้ไขจากของเดิม)
// เพิ่ม: ใช้ usePermissions() ซ่อนปุ่ม "รับรถคืน & ชำระ" ถ้าไม่มีสิทธิ์
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  MagnifyingGlassIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  XMarkIcon,
  BanknotesIcon,
  QrCodeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { Booking, Language } from '../types';
import { calcFee, FeeBreakdown, NOW } from '../data/mockData';
import { usePermissions } from '../context/AuthContext';
import { CustomerAvatar } from './CustomerAvatar';
import paymentQr from '../assets/payment-qr.png';




interface ParkingProps {
  bookings: Booking[];
  lang: Language;
  onMarkPaid: (id: string, method?: 'cash' | 'transfer', finalAmount?: number, couponCode?: string) => void;
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

// ─── Payment Modal ────────────────────────────────────────────────────────────
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

  // ─── Payment step: 'method' = เลือกช่องทาง, 'qr' = โอนเงิน, 'cash' = รับเงินสด ───
  const [step, setStep] = useState<'method' | 'qr' | 'cash'>('method');
  // ยอดเงินบนหน้า QR ที่ admin พิมพ์แก้ได้เอง (เริ่มจากยอดสุทธิที่คำนวณไว้)
  const [amount, setAmount] = useState(finalTotal);

  // ปิด modal แล้วรีเซ็ตสเต็ปกลับไปหน้าเลือกช่องทางเสมอ
  const handleClose = () => {
    setStep('method');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">{lang === 'th' ? 'ชำระเงิน & รับรถคืน' : 'Payment & Return'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{booking.vehicle.plate} · {booking.customer.name}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        {step === 'method' ? (
        <>
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
            onClick={() => { setAmount(finalTotal); setStep('cash'); }}
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
            onClick={() => { setAmount(finalTotal); setStep('qr'); }}
            className="w-full flex items-center gap-3 bg-blue-50 text-blue-700 hover:bg-blue-100 p-3.5 rounded-xl font-semibold transition-colors border border-blue-200"
          >
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <QrCodeIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold">{lang === 'th' ? 'โอนเงิน' : 'Transfer'}</p>
              <p className="text-xs font-normal opacity-70">{lang === 'th' ? 'สแกน QR หรือโอนเงิน' : 'QR scan or bank transfer'}</p>
            </div>
          </button>
        </div>
        </>
        ) : step === 'qr' ? (
        <div className="p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-700 text-center">
            {lang === 'th' ? 'สแกนเพื่อโอนเงิน' : 'Scan to transfer'}
          </p>
          {/* QR ของร้าน (รูปนิ่ง) */}
          <div className="flex justify-center">
            <img
              src={paymentQr}
              alt={lang === 'th' ? 'QR สำหรับโอนเงิน' : 'Transfer QR code'}
              className="w-60 h-60 object-contain rounded-xl border border-slate-100 bg-white p-2"
            />
          </div>
          {/* ช่องกรอกยอดเงินที่ admin พิมพ์แก้ได้ */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <label className="text-xs text-blue-700 font-medium mb-1 block">
              {lang === 'th' ? 'จำนวนเงิน' : 'Amount'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-blue-700">฿</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={e => setAmount(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
                className="w-full bg-transparent text-3xl font-bold text-blue-700 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {lang === 'th'
                ? 'สแกน QR แล้วกรอกยอดตามจำนวนนี้ในแอปธนาคาร'
                : 'Scan the QR and enter this amount in your banking app'}
            </p>
          </div>
          <button
            onClick={() => onConfirm('transfer', amount, couponInput.trim() || undefined)}
            className="w-full bg-blue-600 text-white hover:bg-blue-700 p-3.5 rounded-xl font-semibold transition-colors"
          >
            {lang === 'th' ? 'ยืนยันรับชำระแล้ว' : 'Confirm received'}
          </button>
          <button
            onClick={() => setStep('method')}
            className="w-full bg-slate-50 text-slate-600 hover:bg-slate-100 p-3 rounded-xl font-medium transition-colors border border-slate-100"
          >
            {lang === 'th' ? 'ย้อนกลับ' : 'Back'}
          </button>
        </div>
        ) : (
        /* ── หน้ารับเงินสด (คล้ายหน้าโอนเงิน) ── */
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <BanknotesIcon className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-emerald-700">
              {lang === 'th' ? 'รับชำระด้วยเงินสด' : 'Cash payment'}
            </p>
          </div>
          {/* ยอดเงินสดที่รับ — แก้ไขได้ */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
            <label className="text-xs text-emerald-700 font-medium mb-1 block">
              {lang === 'th' ? 'จำนวนเงินที่รับ' : 'Amount received'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-emerald-700">฿</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={e => setAmount(Number.isNaN(e.target.valueAsNumber) ? 0 : e.target.valueAsNumber)}
                className="w-full bg-transparent text-3xl font-bold text-emerald-700 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {lang === 'th'
                ? 'ตรวจรับเงินสดจากลูกค้าให้ครบก่อนกดยืนยัน'
                : 'Collect the full cash amount before confirming'}
            </p>
          </div>
          <button
            onClick={() => onConfirm('cash', amount, couponInput.trim() || undefined)}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 p-3.5 rounded-xl font-semibold transition-colors"
          >
            {lang === 'th' ? 'ยืนยันรับชำระแล้ว' : 'Confirm received'}
          </button>
          <button
            onClick={() => setStep('method')}
            className="w-full bg-slate-50 text-slate-600 hover:bg-slate-100 p-3 rounded-xl font-medium transition-colors border border-slate-100"
          >
            {lang === 'th' ? 'ย้อนกลับ' : 'Back'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const Parking: React.FC<ParkingProps> = ({ bookings, lang, onMarkPaid }) => {
  // ✅ ดึง permissions จาก context
  const permissions = usePermissions();

  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState('all');
  const [checkInFilter, setCheckInFilter] = useState('');
  const [checkOutFilter, setCheckOutFilter] = useState('');
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);

  const parkedBookings = bookings.filter(b => b.status === 'active');

  const searchOptions = [
    { value: 'all',   label: lang === 'th' ? 'ทั้งหมด' : 'All' },
    { value: 'name',  label: lang === 'th' ? 'ชื่อ' : 'Name' },
    { value: 'plate', label: lang === 'th' ? 'ทะเบียน' : 'Plate' },
    { value: 'phone', label: lang === 'th' ? 'เบอร์โทร' : 'Phone' },
    { value: 'zone',  label: lang === 'th' ? 'โซน' : 'Zone' },
  ];

  const filtered = parkedBookings.filter(b => {
    const q = search.toLowerCase().trim();
    const matchSearch = !q || (() => {
      if (searchBy === 'all') {
        return b.customer.name.toLowerCase().includes(q) ||
               b.vehicle.plate.toLowerCase().includes(q) ||
               b.zone.toLowerCase().includes(q) ||
               b.customer.phone.includes(q) ||
               (!!b.customer.altPhone && b.customer.altPhone.includes(q));
      }
      if (searchBy === 'name')  return b.customer.name.toLowerCase().includes(q);
      if (searchBy === 'plate') return b.vehicle.plate.toLowerCase().includes(q);
      if (searchBy === 'zone')  return b.zone.toLowerCase().includes(q);
      if (searchBy === 'phone') return b.customer.phone.includes(q) || (!!b.customer.altPhone && b.customer.altPhone.includes(q));
      return true;
    })();
    const matchIn  = !checkInFilter  || b.checkIn.toISOString().slice(0, 10)  === checkInFilter;
    const matchOut = !checkOutFilter || b.checkOut.toISOString().slice(0, 10) === checkOutFilter;
    return matchSearch && matchIn && matchOut;
  }).sort((a, b) => {
    // คำนวณค่าและเวลาเพื่อดูว่าเกินเวลา (overMinutes) เท่าไร
    const fbA = calcFee(a.fee, a.checkIn, a.checkOut, NOW);
    const fbB = calcFee(b.fee, b.checkIn, b.checkOut, NOW);

    const overA = Math.max(0, fbA.overMinutes);
    const overB = Math.max(0, fbB.overMinutes);

    if (overA !== overB) {
      return overB - overA; // เรียงคนที่เกินเวลามากที่สุดขึ้นก่อน (มากไปน้อย)
    }
    return a.checkOut.getTime() - b.checkOut.getTime(); // เรียงตามคนที่จะออกใกล้วันปัจจุบันที่สุด
  });

  const zoneColors:      Record<string, string> = { A1: 'bg-purple-600', A2: 'bg-blue-600', B: 'bg-sky-500', C: 'bg-teal-500' };
  const zoneBadgeColors: Record<string, string> = { A1: 'bg-purple-100 text-purple-700', A2: 'bg-blue-100 text-blue-700', B: 'bg-sky-100 text-sky-700', C: 'bg-teal-100 text-teal-700' };

  const zoneSummary = ['A1', 'A2', 'B', 'C']
    .map(zone => ({ zone, count: parkedBookings.filter(b => b.zone === zone).length }))
    .filter(z => z.count > 0);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="mt-14 md:mt-0">
        <h1 className="text-xl font-bold text-slate-800">{lang === 'th' ? 'รถที่จอดอยู่' : 'Current Parking'}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {parkedBookings.length} {lang === 'th' ? 'คันที่จอดอยู่' : 'vehicles currently parked'}
        </p>
      </div>

      {/* Zone summary pills */}
      <div className="flex flex-wrap gap-2">
        {zoneSummary.map(({ zone, count }) => (
          <div key={zone} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${zoneBadgeColors[zone]}`}>
            <span>Zone {zone}</span>
            <span className="bg-white/60 px-1.5 py-0.5 rounded-lg">{count}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 ml-auto">
          {lang === 'th' ? 'ทั้งหมด' : 'Total'}
          <span className="bg-white/60 px-1.5 py-0.5 rounded-lg">{parkedBookings.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 md:p-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <select className="input-field w-28 md:w-32 flex-shrink-0" value={searchBy} onChange={e => setSearchBy(e.target.value)}>
            {searchOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input-field pl-9 pr-9 w-full" placeholder={lang === 'th' ? 'ค้นหา...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <span className="text-xs text-slate-400 whitespace-nowrap">{lang === 'th' ? 'วันเข้า' : 'Check-in Date'}</span>
            <input type="date" className="input-field flex-1 min-w-0" value={checkInFilter} onChange={e => setCheckInFilter(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <span className="text-xs text-slate-400 whitespace-nowrap">{lang === 'th' ? 'วันออก' : 'Check-out Date'}</span>
            <input type="date" className="input-field flex-1 min-w-0" value={checkOutFilter} onChange={e => setCheckOutFilter(e.target.value)} />
          </div>
          {(search || checkInFilter || checkOutFilter || searchBy !== 'all') && (
            <button
              onClick={() => { setSearch(''); setSearchBy('all'); setCheckInFilter(''); setCheckOutFilter(''); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:text-red-600 bg-red-200 hover:bg-red-300 rounded-xl transition-colors border border-transparent hover:border-red-100"
            >
              <XMarkIcon className="w-4 h-4" />
              {lang === 'th' ? 'ล้างตัวกรอง' : 'Clear Filters'}
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <TruckIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{lang === 'th' ? 'ไม่มีรถจอดในขณะนี้' : 'No vehicles currently parked'}</p>
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
                      <p className="text-xs text-slate-400">{lang === 'th' ? 'ช่องจอด' : 'Slot'}</p>
                      <p className="text-sm font-bold text-slate-700">{b.slotNumber.toString().padStart(3,'0')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {b.isWalkIn && <span className="badge bg-slate-100 text-slate-500 text-[10px]">Walk-in</span>}
                    {fb.overMinutes > 0 && (
                      <span className="badge text-[10px] font-bold bg-red-100 text-red-700">
                        {lang === 'th' ? `เกินเวลา ${fmtOver(fb.overMinutes, lang)}` : `Overdue ${fmtOver(fb.overMinutes, lang)}`}
                      </span>
                    )}
                    <span className="badge text-xs bg-green-100 text-green-700">
                      {lang === 'th' ? '● จอดอยู่' : '● Parked'}
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
                  <span className="text-slate-400 font-normal">{b.vehicle.province}</span>
                </div>

                {/* Dates */}
                <div className="text-sm md:text-xs space-y-1 text-slate-500 mb-3">
                  <div className="flex justify-between">
                    <span>{lang === 'th' ? 'วันเข้า' : 'Check-in'}</span>
                    <span className="font-medium text-slate-700">{formatDate(b.checkIn, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'th' ? 'วันออก (กำหนด)' : 'Due out'}</span>
                    <span className="font-medium text-slate-700">{formatDate(b.checkOut, lang)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{lang === 'th' ? 'ระยะเวลา' : 'Duration'}</span>
                    <span className="font-medium text-slate-700">{getDuration(b.checkIn, b.checkOut, lang)}</span>
                  </div>
                </div>

                {/* Vehicle */}
                <p className="text-xs text-slate-400 mb-3">{b.vehicle.brand} {b.vehicle.model}</p>

                {/* Overdue warning */}
                <OverdueWarning fb={fb} lang={lang} />

                {/* Fee */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mb-3">
                  <div>
                    <span className="text-xs text-slate-400">{lang === 'th' ? 'ค่าจอด' : 'Fee'}</span>
                    {isPenalty && (
                      <p className="text-[10px] text-slate-400 line-through">฿{fb.baseFee.toLocaleString()}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-blue-600">฿{fb.totalFee.toLocaleString()}</span>
                </div>

                {/* ✅ Action button — ซ่อนถ้าไม่มีสิทธิ์รับชำระ */}
                {permissions.canMarkPaid ? (
                  <button
                    onClick={() => setPaymentBooking(b)}
                    className="btn-success w-full justify-center text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold"
                  >
                    <TruckIcon className="w-3.5 h-3.5" />
                    {lang === 'th' ? 'รับรถคืน & ชำระ' : 'Return & Pay'}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 py-2 border border-dashed border-slate-200 rounded-xl">
                    <LockClosedIcon className="w-3.5 h-3.5" />
                    {lang === 'th' ? 'ไม่มีสิทธิ์รับชำระเงิน' : 'No payment permission'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payment Modal */}
      {paymentBooking && (
        <PaymentModal
          booking={paymentBooking}
          feeBreakdown={calcFee(paymentBooking.fee, paymentBooking.checkIn, paymentBooking.checkOut, NOW)}
          lang={lang}
          onConfirm={(method, finalAmount, couponCode) => { onMarkPaid(paymentBooking.id, method, finalAmount, couponCode); setPaymentBooking(null); }}
          onClose={() => setPaymentBooking(null)}
        />
      )}
    </div>
  );
};
