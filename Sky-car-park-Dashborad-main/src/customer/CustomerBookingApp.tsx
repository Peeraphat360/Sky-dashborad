// ─────────────────────────────────────────────────────────────────────────────
// src/customer/CustomerBookingApp.tsx
// Customer-facing booking flow (mounted at /book — see main.tsx).
//
//   1. On load, ask the backend who we are (GET /auth/me).
//   2. Not logged in → show <CustomerLogin/> (the LINE button).
//   3. Logged in → show the booking form. Submitting POSTs to /bookings/confirm,
//      which is the FIRST and ONLY time the customer's LINE id + name hit the DB.
//      Logging out or closing the tab beforehand persists nothing.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CustomerLogin } from './CustomerLogin';
import { fetchMe, logout, confirmBooking, LineUser } from './api';

interface SlotOption {
  id: string;
  number: string;
  zoneName: string;
}

const VEHICLE_TYPES = ['sedan', 'suv', 'ev', 'van', 'pickup'];

export const CustomerBookingApp: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<LineUser | null>(null);

  // ─── Check session on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  if (!user) return <CustomerLogin />;

  return <BookingForm user={user} onLogout={() => setUser(null)} />;
};

// ─────────────────────────────────────────────────────────────────────────────

const BookingForm: React.FC<{ user: LineUser; onLogout: () => void }> = ({ user, onLogout }) => {
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotId, setSlotId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [plate, setPlate] = useState('');
  const [province, setProvince] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState('sedan');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedId, setConfirmedId] = useState<string | null>(null);

  // ─── Load available slots (anon SELECT is allowed by RLS) ──────────────────
  useEffect(() => {
    (async () => {
      const { data: slotsData } = await supabase
        .from('parking_slots')
        .select('id, number, zone_id, status')
        .eq('status', 'AVAILABLE');
      const { data: zonesData } = await supabase.from('parking_zones').select('id, name');

      const zones: Record<string, string> = {};
      for (const z of zonesData ?? []) zones[z.id] = z.name;

      const options = (slotsData ?? []).map((s: any) => ({
        id: s.id,
        number: s.number,
        zoneName: zones[s.zone_id] ?? '-',
      }));
      setSlots(options);
      if (options.length) setSlotId(options[0].id);
    })();
  }, []);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!slotId)            { setError('กรุณาเลือกช่องจอด'); return; }
    if (!startTime || !endTime) { setError('กรุณาเลือกเวลาเข้า–ออก'); return; }
    if (new Date(endTime) <= new Date(startTime)) { setError('เวลาออกต้องหลังเวลาเข้า'); return; }
    if (!plate.trim())      { setError('กรุณากรอกทะเบียนรถ'); return; }

    setSubmitting(true);
    try {
      const result = await confirmBooking({
        slotId,
        startTime: new Date(startTime).toISOString(),
        endTime:   new Date(endTime).toISOString(),
        vehiclePlate:    plate.trim(),
        vehicleProvince: province.trim() || undefined,
        vehicleBrand:    brand.trim() || undefined,
        vehicleModel:    model.trim() || undefined,
        vehicleType,
        customerPhone:   phone.trim() || undefined,
      });
      setConfirmedId(result.bookingId);
    } catch (err: any) {
      setError(
        err.message === 'SLOT_NOT_AVAILABLE'
          ? 'ช่องจอดนี้เพิ่งถูกจองไปแล้ว กรุณาเลือกช่องอื่น'
          : err.message ?? 'จองไม่สำเร็จ',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success screen ────────────────────────────────────────────────────────
  if (confirmedId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 px-4">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl shadow-lg border border-slate-100 text-center space-y-4">
          <div className="mx-auto h-14 w-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl">✓</div>
          <h2 className="text-2xl font-bold text-slate-900">ยืนยันการจองเรียบร้อย</h2>
          <p className="text-sm text-slate-500">
            ขอบคุณคุณ <span className="font-semibold text-slate-700">{user.displayName}</span><br />
            รหัสการจอง: <span className="font-mono text-emerald-600">{confirmedId.slice(0, 8)}</span>
          </p>
          <button
            onClick={handleLogout}
            className="mt-4 w-full py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  // ─── Booking form ──────────────────────────────────────────────────────────
  const inputCls =
    'block w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-600 text-white">
          <div>
            <p className="text-xs text-emerald-100">เข้าสู่ระบบด้วย LINE</p>
            <p className="font-semibold">{user.displayName}</p>
          </div>
          <button onClick={handleLogout} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ออกจากระบบ
          </button>
        </div>

        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
          <h2 className="text-lg font-bold text-slate-900">จองที่จอดรถ</h2>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ช่องจอด</label>
            <select className={inputCls} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              {slots.length === 0 && <option value="">— ไม่มีช่องว่าง —</option>}
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  โซน {s.zoneName} · ช่อง {s.number}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">เวลาเข้า</label>
              <input type="datetime-local" className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">เวลาออก</label>
              <input type="datetime-local" className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ทะเบียนรถ</label>
              <input className={inputCls} placeholder="กข 1234" value={plate} onChange={(e) => setPlate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">จังหวัด</label>
              <input className={inputCls} placeholder="กรุงเทพมหานคร" value={province} onChange={(e) => setProvince(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ยี่ห้อ</label>
              <input className={inputCls} placeholder="Toyota" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รุ่น</label>
              <input className={inputCls} placeholder="Camry" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท</label>
              <select className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทร (ไม่บังคับ)</label>
            <input className={inputCls} placeholder="08x-xxx-xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2.5 px-4 rounded-xl border border-red-100">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white text-sm font-semibold shadow-md transition-all active:scale-95 ${
              submitting ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {submitting ? 'กำลังยืนยัน...' : 'ยืนยันการจอง'}
          </button>

          <p className="text-center text-[11px] text-slate-400">
            เมื่อกดยืนยัน ข้อมูล LINE ของคุณจะถูกบันทึกเพื่อใช้ในการจองครั้งนี้
          </p>
        </form>
      </div>
    </div>
  );
};
