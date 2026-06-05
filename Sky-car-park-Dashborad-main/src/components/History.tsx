// src/components/History.tsx
import React, { useState } from 'react';
import { 
  MagnifyingGlassIcon, 
  UserCircleIcon, 
  CalendarDaysIcon,
  BanknotesIcon,
  QrCodeIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Booking, Language } from '../types';
import { translations } from '../data/i18n';

interface HistoryProps {
  bookings: Booking[];
  lang: Language;
}

function formatDateShort(d: Date, lang: Language) {
  if (lang === 'th') {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface CustomerGroup {
  customerId: string;
  name: string;
  phone: string;
  altPhone?: string;
  bookings: Booking[];
  plates: string[];
  totalSpend: number;
  lastVisit: Date;
  totalAllBookings: number;  // นับจาก booking ทั้งหมด (ทุก status)
  isReturning: boolean;      // true = ลูกค้าเก่า (>= 2 bookings)
}

export const History: React.FC<HistoryProps> = ({ bookings, lang }) => {
  const t = translations[lang];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerGroup | null>(null);

  // ─── นับจำนวน booking ทั้งหมดต่อลูกค้า (ใช้เบอร์โทรเป็น key) ─────
  // ใช้ทุก status เพื่อจำแนกว่าลูกค้าเคยจองกี่ครั้ง
  const allBookingCountByPhone = new Map<string, number>();
  bookings.forEach(b => {
    const phone = (b.customer.phone || '').trim();
    if (phone && phone !== '-') {
      allBookingCountByPhone.set(phone, (allBookingCountByPhone.get(phone) ?? 0) + 1);
    }
  });

  const completedBookings = bookings.filter(b => b.status === 'completed');

  // Group by customer phone (เบอร์โทร) แทน user_id
  const customerMap = new Map<string, CustomerGroup>();
  completedBookings.forEach(b => {
    const key = (b.customer.phone || '').trim() || b.customer.id;
    if (!customerMap.has(key)) {
      customerMap.set(key, {
        customerId: b.customer.id,
        name: b.customer.name,
        phone: b.customer.phone,
        altPhone: b.customer.altPhone,
        bookings: [],
        plates: [],
        totalSpend: 0,
        lastVisit: b.checkIn,
        totalAllBookings: 0,
        isReturning: false,
      });
    }
    const grp = customerMap.get(key)!;
    grp.bookings.push(b);
    if (!grp.plates.includes(b.vehicle.plate)) grp.plates.push(b.vehicle.plate);
    if (!grp.altPhone && b.customer.altPhone) grp.altPhone = b.customer.altPhone;
    grp.totalSpend += b.fee;
    if (b.checkIn > grp.lastVisit) grp.lastVisit = b.checkIn;
  });

  // ─── คำนวณสถานะลูกค้าเก่า/ใหม่ ────────────────────────────────────
  customerMap.forEach((grp) => {
    const totalAll = allBookingCountByPhone.get(grp.phone) ?? grp.bookings.length;
    grp.totalAllBookings = totalAll;
    grp.isReturning = totalAll >= 2;
  });

  const customers = Array.from(customerMap.values()).sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());

  // Stats
  const returningCount = customers.filter(c => c.isReturning).length;
  const newCount = customers.filter(c => !c.isReturning).length;

  const q = search.toLowerCase().trim();
  const isPlateSearch = /^[ก-ฮa-zA-Z]/.test(q) && q.length >= 2;

  let filtered = customers;
  let plateMatch: { customer: CustomerGroup; plate: string } | null = null;

  if (q) {
    if (isPlateSearch) {
      // Search by plate
      const found = customers.find(c => c.plates.some(p => p.toLowerCase().includes(q)));
      if (found) {
        const plate = found.plates.find(p => p.toLowerCase().includes(q)) || '';
        plateMatch = { customer: found, plate };
      }
      filtered = customers.filter(c => c.plates.some(p => p.toLowerCase().includes(q)));
    } else {
      filtered = customers.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q) || (!!c.altPhone && c.altPhone.includes(q))
      );
    }
  }

  const zoneColors: Record<string, string> = {
    A1: 'bg-purple-100 text-purple-700',
    A2: 'bg-blue-100 text-blue-700',
    B: 'bg-sky-100 text-sky-700',
    C: 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5">
      <div className='mt-14 md:mt-0'>
        <h1 className="text-xl font-bold text-slate-800">{t.history.title}</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-slate-400">{customers.length} {lang === 'th' ? 'ลูกค้า' : 'customers'}</p>
          {returningCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              <ArrowPathIcon className="w-3 h-3" />
              {returningCount} {lang === 'th' ? 'ลูกค้าเก่า' : 'returning'}
            </span>
          )}
          {newCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <SparklesIcon className="w-3 h-3" />
              {newCount} {lang === 'th' ? 'ลูกค้าใหม่' : 'new'}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input-field pl-10"
          placeholder={t.history.search}
          value={search}
          onChange={e => { setSearch(e.target.value); setSelected(null); }}
        />
      </div>

      {/* Plate search result banner */}
      {isPlateSearch && plateMatch && (
        <div className="card p-4 border-l-4 border-blue-500 bg-blue-50">
          <p className="text-xs text-blue-500 font-semibold mb-1">{t.history.plateOwner}</p>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg text-sm">{plateMatch.plate}</span>
            <span className="text-slate-700 font-medium">{plateMatch.customer.name}</span>
            <span className="text-slate-400 text-xs">
              {plateMatch.customer.phone}{plateMatch.customer.altPhone ? ` · ${plateMatch.customer.altPhone}` : ''}
            </span>
          </div>
        </div>
      )}

      {isPlateSearch && !plateMatch && q && (
        <div className="card p-4 text-center text-slate-400 text-sm">
          {lang === 'th' ? `ไม่พบทะเบียน "${search}" ในระบบ` : `Plate "${search}" not found in system`}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer list */}
        <div className="md:col-span-1 space-y-2">
          {filtered.length === 0 && (
            <div className="card p-6 text-center text-slate-400 text-sm">{t.history.noHistory}</div>
          )}
          {filtered.map(cust => (
            <button
              key={cust.phone || cust.customerId}
              onClick={() => setSelected(cust)}
              className={`card p-4 w-full text-left hover:shadow-md transition-all ${selected?.phone === cust.phone ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                  cust.isReturning
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
                }`}>
                  {cust.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-slate-800 truncate">{cust.name}</p>
                    {cust.isReturning ? (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200 flex-shrink-0">
                        <ArrowPathIcon className="w-2.5 h-2.5" />
                        {lang === 'th' ? 'ลูกค้าเก่า' : 'Returning'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
                        <SparklesIcon className="w-2.5 h-2.5" />
                        {lang === 'th' ? 'ใหม่' : 'New'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {cust.phone}{cust.altPhone ? ` · ${cust.altPhone}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{cust.totalAllBookings} {lang === 'th' ? 'ครั้ง' : 'visits'}</span>
                <span className="font-semibold text-blue-600">฿{cust.totalSpend.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cust.plates.map(p => (
                  <span key={p} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{p}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Customer detail */}
        <div className="md:col-span-2">
          {!selected ? (
            <div className="card hidden md:flex h-full flex-col items-center justify-center text-slate-300 p-12">
              <UserCircleIcon className="w-16 h-16 mb-3" />
              <p className="text-sm">{lang === 'th' ? 'เลือกลูกค้าเพื่อดูรายละเอียด' : 'Select a customer to view details'}</p>
            </div>
          ) : (
            <div className="card p-5">
              {/* Customer header */}
              <div className="flex items-start gap-4 mb-5 pb-5 border-b border-slate-100">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold ${
                  selected.isReturning
                    ? 'bg-gradient-to-br from-purple-500 to-purple-800'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-800'
                }`}>
                  {selected.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-lg">{selected.name}</h3>
                    {selected.isReturning ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200">
                        <ArrowPathIcon className="w-3.5 h-3.5" />
                        {lang === 'th' ? 'ลูกค้าเก่า' : 'Returning Customer'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                        <SparklesIcon className="w-3.5 h-3.5" />
                        {lang === 'th' ? 'ลูกค้าใหม่' : 'New Customer'}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {selected.phone}{selected.altPhone ? ` · ${selected.altPhone}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    ID: {selected.customerId.slice(0, 8)}…
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.plates.map(p => (
                      <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-mono">{p}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">฿{selected.totalSpend.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{t.history.totalSpend}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className={`rounded-xl p-3 text-center ${
                  selected.isReturning ? 'bg-purple-50 border border-purple-100' : 'bg-emerald-50 border border-emerald-100'
                }`}>
                  <p className={`text-sm font-bold ${
                    selected.isReturning ? 'text-purple-700' : 'text-emerald-700'
                  }`}>
                    {selected.isReturning
                      ? (lang === 'th' ? 'ลูกค้าเก่า' : 'Returning')
                      : (lang === 'th' ? 'ลูกค้าใหม่' : 'New')
                    }
                  </p>
                  <p className="text-xs text-slate-400">{lang === 'th' ? 'สถานะ' : 'Status'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">{selected.totalAllBookings}</p>
                  <p className="text-xs text-slate-400">{t.history.totalVisits}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-slate-700">฿{Math.round(selected.totalSpend / selected.bookings.length).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{lang === 'th' ? 'เฉลี่ย/ครั้ง' : 'Avg/visit'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-slate-700">{formatDateShort(selected.lastVisit, lang)}</p>
                  <p className="text-xs text-slate-400">{t.history.lastVisit}</p>
                </div>
              </div>

              {/* Booking history */}
              <h4 className="font-semibold text-slate-600 text-sm mb-3 flex items-center gap-2">
                <CalendarDaysIcon className="w-4 h-4" />
                {t.history.bookingHistory}
              </h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {selected.bookings
                  .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime())
                  .map(b => (
                    <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                      <span className={`badge text-[10px] font-bold ${zoneColors[b.zone] || 'bg-blue-100 text-blue-700'}`}>Zone {b.zone}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{b.vehicle.plate} · {b.vehicle.brand} {b.vehicle.model}</p>
                        <p className="text-[10px] text-slate-400">{formatDateShort(b.checkIn, lang)} → {formatDateShort(b.checkOut, lang)}</p>
                      </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-bold text-blue-600 block">฿{b.fee.toLocaleString()}</span>
                              {b.paymentMethod && (
                                <div className={`flex items-center justify-end gap-1 mt-1 px-1.5 py-0.5 rounded border text-[10px] font-medium w-fit ml-auto ${
                                  b.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-blue-50 text-blue-600 border-blue-200'
                                }`}>
                                  {b.paymentMethod === 'cash' ? <BanknotesIcon className="w-3 h-3" /> : <QrCodeIcon className="w-3 h-3" />}
                                  {b.paymentMethod === 'cash' ? (lang === 'th' ? 'เงินสด' : 'Cash') : (lang === 'th' ? 'โอนเงิน' : 'Transfer')}
                                </div>
                              )}
                            </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};