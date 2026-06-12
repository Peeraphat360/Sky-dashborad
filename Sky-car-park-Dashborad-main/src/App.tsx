import { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Bookings } from './components/Bookings';
import { History } from './components/History';
import { Revenue } from './components/Revenue';
import { Parking } from './components/Parking';
import { Login } from './components/Login';
import { Booking, Language, ParkingSlot, TabId, Zone, CarType, SlotStatus, BookingStatus } from './types';
import { supabase } from './lib/supabase';
import { calcFee } from './data/mockData';
import { BellAlertIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Customer row used as the owner of walk-in bookings (seeded user).
const WALKIN_USER_ID = 'fe346324-ff72-4656-9f0a-478da7c91afa';

// DB booking_status → frontend BookingStatus (no longer derived from slot state).
const DB_STATUS_TO_FE: Record<string, BookingStatus> = {
  PENDING:   'pending',
  CONFIRMED: 'confirmed',
  PARKED:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED:   'cancelled',
};

// created_at / paid_at ในDB เป็นเวลา UTC แต่ไม่มี timezone suffix → เติม Z ให้ JS
// แปลงเป็นเวลาท้องถิ่น (ไทย) ถูกต้อง  (start_time/end_time เก็บเป็น local อยู่แล้ว ไม่ต้องเติม)
const parseUtc = (s?: string | null): Date => {
  if (!s) return new Date();
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
};

// เสียงแจ้งเตือนจองใหม่ — เล่นไฟล์เสียงใน public/ (best-effort — ถ้า browser
// บล็อกหรือโหลดไฟล์ไม่ได้ จะ fallback เป็นเสียง beep สังเคราะห์)
function playAlertSound() {
  try {
    const audio = new Audio('/booking-alert.m4a');
    audio.play().catch(() => playBeepFallback());
  } catch {
    playBeepFallback();
  }
}

function playBeepFallback() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.start(t0);
      o.stop(t0 + 0.18);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* ignore */ }
}

function AppInner() {
  const { isAuthenticated, permissions } = useAuth();
  const defaultTab = (permissions?.tabs[0] ?? 'dashboard') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [lang, setLang] = useState<Language>('th');
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  // popup แจ้งเตือนเมื่อมีลูกค้าจองออนไลน์เข้ามาใหม่
  const [bookingAlert, setBookingAlert] = useState<{ name: string; plate?: string } | null>(null);
  // แท็บที่เลือกในหน้าการจอง (ยกขึ้นมาเพื่อให้ popup สั่งไปแท็บ "รอยืนยันออนไลน์" ได้)
  const [bookingsFilter, setBookingsFilter] = useState<'confirmed' | 'pending'>('confirmed');

  const safeTab = permissions?.tabs.includes(activeTab) ? activeTab : defaultTab;
  const handleSetTab = (tab: TabId) => {
    if (permissions?.tabs.includes(tab)) setActiveTab(tab);
  };

  // ─── Fetch data from Supabase ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
    // Fetch zones and slots as separate queries to avoid FK-join cache issues
    const { data: zonesData } = await supabase
      .from('parking_zones')
      .select('id, name, floor');

    const { data: slotsData } = await supabase
      .from('parking_slots')
      .select('id, number, status, zone_id');

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, payments(*), users(line_id, line_user_id, picture_url)')
      .order('created_at', { ascending: false });

    const zones: Record<string, string> = {};
    if (zonesData) {
      for (const z of zonesData) zones[z.id] = z.name;
    }

    let mappedSlots: ParkingSlot[] = [];
    if (slotsData) {
      mappedSlots = slotsData.map((s: any) => {
        const dbZoneName = zones[s.zone_id] ?? 'B';
        const numPart = s.number.split('-')[1]; // e.g. "001"
        const slotNum = parseInt(numPart) || 1;

        let frontendZone: Zone = 'B';
        if (dbZoneName === 'A1') {
          frontendZone = 'A1';
        } else if (dbZoneName === 'A2') {
          frontendZone = 'A2';
        } else if (dbZoneName === 'A') {
          // legacy: single 'A' zone split by slot number
          frontendZone = slotNum <= 1 ? 'A1' : 'A2';
        } else if (dbZoneName === 'B') {
          frontendZone = 'B';
        } else if (dbZoneName === 'C') {
          frontendZone = 'C';
        }

        const rawStatus = (s.status ?? '').toLowerCase();
        const normalizedStatus: SlotStatus =
          rawStatus === 'occupied' ? 'occupied' :
          rawStatus === 'reserved' ? 'reserved' : 'available';

        return {
          id: s.id,
          number: slotNum,
          status: normalizedStatus,
          zone: frontendZone,
          types: ['sedan', 'suv'] as CarType[],
          bookingId: undefined,
        };
      });
      setSlots(mappedSlots);
    }

    if (bookingsData) {
      setBookings(bookingsData.map((b: any) => {
        const slot = mappedSlots.find((s) => s.id === b.slot_id);

        const derivedStatus: BookingStatus = DB_STATUS_TO_FE[b.status] ?? 'pending';

        const payment = b.payments?.[0];

        return {
          id: b.id,
          slotId: b.slot_id,
          zone: (slot ? slot.zone : 'B') as Zone,
          slotNumber: slot ? slot.number : 0,
          customer: {
            id: b.user_id,
            name: b.customer_name || '-',
            phone: b.customer_phone || '-',
            altPhone: b.customer_alt_phone || undefined,
            lineId: b.users?.line_user_id || b.users?.line_id || undefined,
            pictureUrl: b.users?.picture_url || undefined,
          },
          vehicle: { 
            plate: b.vehicle_plate || '-', 
            province: b.vehicle_province || '-', 
            brand: b.vehicle_brand || '-', 
            model: b.vehicle_model || '-', 
            type: (b.vehicle_type || 'sedan') as CarType 
          },
          checkIn: new Date(b.start_time),
          checkOut: new Date(b.end_time),
          fee: b.fee || 0,
          status: derivedStatus,
          createdAt: parseUtc(b.created_at),
          isWalkIn: b.is_walk_in !== false,
          // จองออนไลน์ที่หาช่องไม่ได้ (เต็ม) → slot_id เป็น null, ยัง PENDING, ไม่ใช่ walk-in
          isFull: !b.slot_id && b.status === 'PENDING' && b.is_walk_in === false,
          paymentMethod: payment ? (payment.method === 'CASH' ? 'cash' : 'transfer') : undefined,
          paidAt: payment ? parseUtc(payment.paid_at || payment.created_at) : undefined,
          remarks: b.remarks || undefined,
        };
      }));
    }

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchData();

    // ─── Realtime subscription: parking_slots ───────────────────────────
    const slotsChannel = supabase
      .channel('realtime-parking-slots')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'parking_slots',
      }, () => {
        fetchData();
      })
      .subscribe();

    // ─── Realtime subscription: bookings ────────────────────────────────
    const bookingsChannel = supabase
      .channel('realtime-bookings')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
      }, (payload: any) => {
        fetchData();
        const row = payload?.new;
        // จองออนไลน์ใหม่ (PENDING + ไม่ใช่ walk-in) → เด้ง popup แจ้งแอดมิน + เสียง
        if (payload?.eventType === 'INSERT' && row && row.status === 'PENDING' && row.is_walk_in === false) {
          setBookingAlert({ name: row.customer_name || 'ลูกค้า', plate: row.vehicle_plate || undefined });
          playAlertSound();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [isAuthenticated, fetchData]);

  // ปิด popup แจ้งเตือนอัตโนมัติหลัง 12 วินาที
  useEffect(() => {
    if (!bookingAlert) return;
    const t = setTimeout(() => setBookingAlert(null), 12000);
    return () => clearTimeout(t);
  }, [bookingAlert]);

  // ─── LINE service ─────────────────────────────────────────────────────────
  // แจ้ง LINE service ให้ push ข้อความเข้า LINE ลูกค้า (best-effort — ไม่บล็อก UI
  // และไม่ alert ถ้าส่งไม่สำเร็จ เพราะการบันทึก DB สำคัญกว่าและทำไปแล้ว)
  const notifyLine = useCallback(async (path: string) => {
    const base = import.meta.env.VITE_LINE_SERVICE_URL ?? 'http://localhost:8000';
    try {
      const res = await fetch(`${base}${path}`, { method: 'POST' });
      if (!res.ok) console.warn('LINE notify failed:', path, res.status, await res.text());
    } catch (e) {
      console.warn('LINE notify error:', path, e);
    }
  }, []);

  // ─── Booking handlers ─────────────────────────────────────────────────────
  // เช็คเอาท์ + ชำระเงิน: booking → COMPLETED, ช่อง → AVAILABLE, สร้าง payment (atomic ใน RPC เดียว)
  const handleMarkPaid = useCallback(async (id: string, method?: 'cash' | 'transfer', finalAmount?: number, couponCode?: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    // คำนวณค่าจอดจากเวลาออกจริง (now) ตามอัตรา/ค่าปรับใน calcFee
    // ถ้ามียอดสุทธิจากหน้าชำระเงิน (เช่น หักคูปองส่วนลดแล้ว) ให้ใช้ยอดนั้นแทน
    const computed = calcFee(booking.fee, booking.checkIn, booking.checkOut, new Date()).totalFee;
    const amount = (typeof finalAmount === 'number' && finalAmount >= 0) ? finalAmount : computed;
    const dbMethod = method === 'cash' ? 'CASH' : 'QR';
    // ส่ง null เมื่อไม่ได้ใช้คูปอง (RPC จะ TRIM/NULLIF ให้อีกชั้น)
    const couponCodeValue = couponCode && couponCode.trim() ? couponCode.trim() : null;

    const { error } = await supabase.rpc('checkout_booking', {
      p_booking_id: id,
      p_method: dbMethod,
      p_amount: amount,
      p_coupon_code: couponCodeValue,
    });
    if (error) { alert((lang === 'th' ? 'บันทึกการชำระเงินไม่สำเร็จ: ' : 'Checkout failed: ') + error.message); return; }
    fetchData();
    void notifyLine(`/receipts/${id}/send`);          // UC5 — push ใบเสร็จเข้า LINE
  }, [bookings, fetchData, lang, notifyLine]);

  const handleCancel = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('cancel_booking', { p_booking_id: id });
    if (error) { alert((lang === 'th' ? 'ยกเลิกไม่สำเร็จ: ' : 'Cancel failed: ') + error.message); return; }
    fetchData();
  }, [fetchData, lang]);

  // เพิ่ม Walk-in: insert booking CONFIRMED + จองช่อง (RESERVED) แบบ atomic พร้อมกันช่องไม่ว่าง
  const handleAddBooking = useCallback(async (booking: Booking) => {
    // ถ้า booking ผูกกับลูกค้าจริง (customer.id เป็น uuid เช่น walk-in จากหน้าประวัติ)
    // ให้ใช้ user id นั้น — ไม่งั้นใช้ลูกค้า walk-in รวม (เพิ่มการจองทั่วไป)
    const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const ownerId = isUuid(booking.customer.id) ? booking.customer.id : WALKIN_USER_ID;
    const { error } = await supabase.rpc('create_walkin_booking', {
      p_user_id: ownerId,
      p_slot_id: booking.slotId,
      p_start_time: booking.checkIn,
      p_end_time: booking.checkOut,
      p_customer_name: booking.customer.name,
      p_customer_phone: booking.customer.phone,
      p_customer_alt_phone: booking.customer.altPhone || null,
      p_vehicle_plate: booking.vehicle.plate,
      p_vehicle_province: booking.vehicle.province,
      p_vehicle_brand: booking.vehicle.brand,
      p_vehicle_model: booking.vehicle.model,
      p_vehicle_type: booking.vehicle.type,
      p_fee: booking.fee,
      p_remarks: booking.remarks || null,
    });
    if (error) {
      const msg = error.message.includes('SLOT_NOT_AVAILABLE')
        ? (lang === 'th' ? 'ช่องจอดนี้ไม่ว่างแล้ว กรุณาเลือกช่องอื่น' : 'This slot is no longer available.')
        : (lang === 'th' ? 'เพิ่มการจองไม่สำเร็จ: ' : 'Add booking failed: ') + error.message;
      alert(msg);
      return;
    }
    fetchData();
  }, [fetchData, lang]);

  // อัปเดตข้อมูลโปรไฟล์ลูกค้า (ชื่อ/เบอร์) — เรียกตอน walk-in จากหน้าประวัติแล้ว admin
  // เลือก "อัปเดตโปรไฟล์" (best-effort; ถ้า RLS บล็อกจะไม่กระทบการจอง)
  const handleUpdateCustomer = useCallback(async (
    userId: string,
    fields: { name?: string; phone?: string },
  ) => {
    const payload: Record<string, string> = {};
    if (fields.name) payload.name = fields.name;
    if (fields.phone) payload.phone = fields.phone;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from('users').update(payload).eq('id', userId);
    if (error) console.warn('update customer profile failed:', error.message);
    fetchData();
  }, [fetchData]);

  // แก้ไขรายละเอียด (ไม่เปลี่ยนสถานะ/ช่องจอด จึง update ตรงได้)
  const handleEditBooking = useCallback(async (updatedBooking: Booking) => {
    await supabase.from('bookings').update({
      start_time: updatedBooking.checkIn,
      end_time: updatedBooking.checkOut,
      customer_name: updatedBooking.customer.name,
      customer_phone: updatedBooking.customer.phone,
      customer_alt_phone: updatedBooking.customer.altPhone || null,
      vehicle_plate: updatedBooking.vehicle.plate,
      vehicle_province: updatedBooking.vehicle.province,
      vehicle_brand: updatedBooking.vehicle.brand,
      vehicle_model: updatedBooking.vehicle.model,
      vehicle_type: updatedBooking.vehicle.type,
      fee: updatedBooking.fee,
      remarks: updatedBooking.remarks || null,
    }).eq('id', updatedBooking.id);
    fetchData();
  }, [fetchData]);

  // เข้าจอด: booking → PARKED, ช่อง → OCCUPIED (atomic)
  const handleCheckIn = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('check_in_booking', { p_booking_id: id });
    if (error) { alert((lang === 'th' ? 'เช็คอินไม่สำเร็จ: ' : 'Check-in failed: ') + error.message); return; }
    fetchData();
  }, [fetchData, lang]);

  // ยืนยันการจองออนไลน์: PENDING → CONFIRMED, ช่อง → RESERVED (atomic)
  const handleConfirmBooking = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('confirm_booking', { p_booking_id: id });
    if (error) { alert((lang === 'th' ? 'ยืนยันไม่สำเร็จ: ' : 'Confirm failed: ') + error.message); return; }
    fetchData();
    void notifyLine(`/notifications/${id}/confirmed`); // UC3 — push แจ้งยืนยันการจอง
  }, [fetchData, lang, notifyLine]);

  // แจ้งเตือนลูกค้าว่าช่องเต็ม (สำหรับการจองที่เข้ามาตอนช่องไม่ว่าง): push LINE บอกว่า
  // ช่วงวันที่เลือกเต็ม + ช่องจะว่างอีกวันไหน (line-service คำนวณให้) แล้วปิดรายการ (CANCELLED)
  const handleNotifyFull = useCallback(async (id: string) => {
    const base = import.meta.env.VITE_LINE_SERVICE_URL ?? 'http://localhost:8000';
    let pushOk = true;
    try {
      const res = await fetch(`${base}/notifications/${id}/slot-full`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      pushOk = res.ok && body?.sent !== false;
    } catch { pushOk = false; }
    // ปิดรายการเต็มออกจากคิว (ยืนยันไม่ได้เพราะไม่มีช่อง) — authenticated update policy อนุญาต
    await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', id);
    fetchData();
    if (!pushOk) {
      alert(lang === 'th'
        ? 'ปิดรายการแล้ว แต่ส่ง LINE แจ้งลูกค้าไม่สำเร็จ (ลูกค้าอาจยังไม่ได้เพิ่มเพื่อน OA)'
        : 'Closed the request, but the LINE notice could not be delivered.');
    }
  }, [fetchData, lang]);

  // ย้ายรถไปช่องใหม่: ช่องเก่า → AVAILABLE, ช่องใหม่ → OCCUPIED (atomic + กันช่องไม่ว่าง)
  const handleMoveBooking = useCallback(async (bookingId: string, newSlotId: string) => {
    const { error } = await supabase.rpc('move_booking', { p_booking_id: bookingId, p_new_slot_id: newSlotId });
    if (error) {
      const msg = error.message.includes('SLOT_NOT_AVAILABLE')
        ? (lang === 'th' ? 'ช่องปลายทางไม่ว่างแล้ว' : 'Target slot is no longer available.')
        : (lang === 'th' ? 'ย้ายไม่สำเร็จ: ' : 'Move failed: ') + error.message;
      alert(msg);
      return;
    }
    fetchData();
  }, [fetchData, lang]);

  if (!isAuthenticated) return <Login />;

  // แสดงหน้าโหลดเฉพาะตอนโหลดครั้งแรก (ยังไม่มีข้อมูล) — refetch จะไม่ unmount หน้า
  // เพื่อไม่ให้ state ในหน้า (เช่น แท็บที่เลือก/ค้นหา) ถูกรีเซ็ตหลังปฏิเสธ/แก้ไข
  if (loading && bookings.length === 0 && slots.length === 0) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <p className="text-slate-400">กำลังโหลด...</p>
    </div>
  );

  const renderTab = () => {
    switch (safeTab) {
      case 'dashboard':
        return <Dashboard slots={slots} bookings={bookings} lang={lang} onMoveBooking={handleMoveBooking} />;
      case 'bookings':
        return (
          <Bookings
            bookings={bookings}
            slots={slots}
            lang={lang}
            onMarkPaid={handleMarkPaid}
            onCancel={handleCancel}
            onAdd={handleAddBooking}
            onEdit={handleEditBooking}
            onCheckIn={handleCheckIn}
            onConfirmPending={handleConfirmBooking}
            onNotifyFull={handleNotifyFull}
            filter={bookingsFilter}
            onFilterChange={setBookingsFilter}
          />
        );
      case 'parking':
        return <Parking bookings={bookings} lang={lang} onMarkPaid={handleMarkPaid} />;
      case 'history':
        return (
          <History
            bookings={bookings}
            slots={slots}
            lang={lang}
            onAdd={handleAddBooking}
            onUpdateCustomer={handleUpdateCustomer}
          />
        );
      case 'revenue':
        return <Revenue bookings={bookings} lang={lang} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar activeTab={safeTab} setActiveTab={handleSetTab} lang={lang} setLang={setLang} bookings={bookings} slots={slots} />
      <main className="flex-1 md:ml-60 h-screen overflow-y-auto pb-16 md:pb-0">
        {renderTab()}
      </main>

      {/* Popup แจ้งเตือนจองออนไลน์ใหม่ */}
      {bookingAlert && (
        <>
          <style>{`@keyframes alertFade{from{opacity:0}to{opacity:1}}`}</style>
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-[60] w-[92%] sm:w-80"
            style={{ animation: 'alertFade 0.3s ease' }}
          >
            <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <BellAlertIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{lang === 'th' ? '🔔 มีการจองใหม่!' : '🔔 New booking!'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lang === 'th' ? 'ลูกค้าจองออนไลน์เข้ามา' : 'New online booking received'}</p>
                  <p className="text-sm font-semibold text-slate-700 mt-1 truncate">
                    {bookingAlert.name}{bookingAlert.plate ? ` · ${bookingAlert.plate}` : ''}
                  </p>
                </div>
                <button onClick={() => setBookingAlert(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => { setBookingsFilter('pending'); handleSetTab('bookings'); setBookingAlert(null); }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                {lang === 'th' ? 'ดูการจอง →' : 'View booking →'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
