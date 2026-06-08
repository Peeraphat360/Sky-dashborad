// ─── Core Types ───────────────────────────────────────────────────────────────

export type Language = 'th' | 'en';

export type TabId = 'dashboard' | 'bookings' | 'parking' | 'history' | 'revenue';

export type Zone = 'A1' | 'A2' | 'B' | 'C';

export type CarType = 'supercar' | 'sedan' | 'suv' | 'ev' | 'van' | 'pickup' | 'pickup_closed';

export type SlotStatus = 'available' | 'occupied' | 'reserved';

export type BookingStatus = 'confirmed' | 'active' | 'completed' | 'cancelled' | 'pending';

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  lineId?: string;       // LINE userId จาก login — ใช้แยกลูกค้าใหม่/เก่า (ไม่ซ้ำต่อบัญชี)
  pictureUrl?: string;   // รูปโปรไฟล์ LINE (backfill จาก Messaging API)
}

export interface Vehicle {
  plate: string;
  province: string;
  brand: string;
  model: string;
  type: CarType;
}

export interface CarCatalogItem {
  id: string;
  brand: string;
  model: string;
  type: CarType;
}

export interface ParkingSlot {
  id: string;
  zone: Zone;
  number: number;
  types: CarType[];
  status: SlotStatus;
  bookingId?: string;
}

export interface Booking {
  id: string;
  slotId: string;
  zone: Zone;
  slotNumber: number;
  customer: Customer;
  vehicle: Vehicle;
  checkIn: Date;
  checkOut: Date;
  fee: number;
  status: BookingStatus;
  createdAt: Date;
  isWalkIn: boolean;
  paymentMethod?: 'cash' | 'transfer';
  paidAt?: Date;
  remarks?: string;
}