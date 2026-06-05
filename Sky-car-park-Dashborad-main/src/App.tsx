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

function AppInner() {
  const { isAuthenticated, permissions } = useAuth();
  const defaultTab = (permissions?.tabs[0] ?? 'dashboard') as TabId;
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [lang, setLang] = useState<Language>('th');
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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
      .select('*, payments(*)')
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
            altPhone: b.customer_alt_phone || undefined
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
          createdAt: new Date(b.created_at),
          isWalkIn: b.is_walk_in !== false,
          paymentMethod: payment ? (payment.method === 'CASH' ? 'cash' : 'transfer') : undefined,
          paidAt: payment ? new Date(payment.paid_at || payment.created_at) : undefined,
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
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(bookingsChannel);
    };
  }, [isAuthenticated, fetchData]);

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
    const { error } = await supabase.rpc('create_walkin_booking', {
      p_user_id: WALKIN_USER_ID,
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

  if (loading) return (
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
          />
        );
      case 'parking':
        return <Parking bookings={bookings} lang={lang} onMarkPaid={handleMarkPaid} />;
      case 'history':
        return <History bookings={bookings} lang={lang} />;
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
