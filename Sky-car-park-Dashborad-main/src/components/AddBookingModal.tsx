import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Booking, CarType, Language, ParkingSlot, Zone } from '../types';
import { translations } from '../data/i18n';
import { recommendZone, NOW } from '../data/mockData';
import { ThaiDateTimePicker } from './Thaidatetimepicker';
import { ProvinceCombobox } from './ProvinceCombobox';
import { supabase } from '../lib/supabase';

interface CarModel {
  brand: string;
  model: string;
}

// ข้อมูลลูกค้าเดิม (ดึงมา pre-fill ตอนจอง Walk-in จากหน้าประวัติลูกค้า)
export interface PrefillCustomer {
  customerId: string;
  name: string;
  phone: string;
  altPhone?: string;
  plate?: string;
  province?: string;
  brand?: string;
  model?: string;
  carType?: CarType;
}

interface AddBookingModalProps {
  onClose: () => void;
  onAdd: (booking: Booking) => void;
  onEdit?: (booking: Booking) => void;
  slots: ParkingSlot[];
  bookings: Booking[];
  lang: Language;
  editingBooking?: Booking | null;
  prefill?: PrefillCustomer | null;
  onUpdateCustomer?: (userId: string, fields: { name?: string; phone?: string }) => void;
}

export const AddBookingModal: React.FC<AddBookingModalProps> = ({ onClose, onAdd, onEdit, slots, bookings, lang, editingBooking, prefill, onUpdateCustomer }) => {
  const t = translations[lang];

  const formatLocalDatetime = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [form, setForm] = useState({
    name: editingBooking?.customer.name || prefill?.name || '',
    phone: editingBooking?.customer.phone || prefill?.phone || '',
    altPhone: editingBooking?.customer.altPhone || prefill?.altPhone || '',
    plate: editingBooking?.vehicle.plate || prefill?.plate || '',
    province: editingBooking?.vehicle.province || prefill?.province || '',
    brand: editingBooking?.vehicle.brand || prefill?.brand || '',
    model: editingBooking?.vehicle.model || prefill?.model || '',
    carType: editingBooking?.vehicle.type || prefill?.carType || 'sedan' as CarType,
    checkIn: editingBooking ? formatLocalDatetime(editingBooking.checkIn) : formatLocalDatetime(NOW),
    checkOut: editingBooking ? formatLocalDatetime(editingBooking.checkOut) : '',
    remarks: editingBooking?.remarks || '',
  });

  const [recommended, setRecommended] = useState<Zone>(editingBooking ? editingBooking.zone : 'B');

  // Car brand/model data fetched from Supabase (car_models table)
  const [carModels, setCarModels] = useState<CarModel[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('car_models')
        .select('brand, model')
        .order('brand', { ascending: true })
        .order('model', { ascending: true });
      if (active && !error && data) setCarModels(data as CarModel[]);
    })();
    return () => { active = false; };
  }, []);

  // Unique brand list (no duplicates), preserving fetched order
  const brands = Array.from(new Set(carModels.map(c => c.brand))).filter(Boolean);

  // Models belonging to the currently selected brand (deduped — car_models can
  // hold repeat brand/model rows, which would otherwise produce duplicate keys)
  const modelsForBrand = Array.from(new Set(
    carModels
      .filter(c => c.brand === form.brand)
      .map(c => c.model)
      .filter(Boolean)
  ));

  useEffect(() => {
    setRecommended(recommendZone(form.carType) as Zone);
  }, [form.carType]);

  // ── ค่าบริการ: ฐาน (วันละ 150) + ค่าบริการนอกเวลา (+50 ต่อขา ก่อน 08:00 / หลัง 21:00) ──
  const offHoursFee = (datetimeLocal: string): number => {
    const t = (datetimeLocal.split('T')[1] || '');
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    return mins < 8 * 60 || mins > 21 * 60 ? 50 : 0;   // 08:00/21:00 ตรง = ฟรี
  };
  const rentalDays = form.checkIn && form.checkOut
    ? Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000))
    : 0;
  const baseFee = rentalDays * 150;
  const surchargeIn = form.checkIn ? offHoursFee(form.checkIn) : 0;
  const surchargeOut = form.checkOut ? offHoursFee(form.checkOut) : 0;
  const estimatedFee = baseFee + surchargeIn + surchargeOut;

  const handleSubmit = () => {
    if (!form.name || !form.phone || !form.plate || !form.checkIn || !form.checkOut) {
      alert(lang === 'th' ? 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, เบอร์โทร, ทะเบียน, เวลาเข้า-ออก)' : 'Please fill in all required fields (Name, Phone, Plate, Check-in/out).');
      return;
    }

    if (form.phone.length !== 10) {
      alert(lang === 'th' ? 'กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก' : 'Please enter exactly 10 digits for phone number.');
      return;
    }

    if (form.altPhone && form.altPhone.length !== 10) {
      alert(lang === 'th' ? 'กรุณากรอกเบอร์สำรองให้ครบ 10 หลัก หรือเว้นว่างไว้' : 'Please enter exactly 10 digits for alternate phone number, or leave it blank.');
      return;
    }

    if (form.remarks && form.remarks.length > 1000) {
      alert(lang === 'th' ? 'หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร' : 'Remarks must not exceed 1,000 characters.');
      return;
    }

    // ล็อกวันย้อนหลัง + วันออกต้องหลังวันเข้า
    if (form.checkIn < formatLocalDatetime(NOW).slice(0, 10)) {
      alert(lang === 'th' ? 'ไม่สามารถเลือกวันที่ย้อนหลังได้' : 'Cannot select a past date.');
      return;
    }
    if (new Date(form.checkOut) <= new Date(form.checkIn)) {
      alert(lang === 'th' ? 'วันรับรถต้องอยู่หลังวันเข้าจอด' : 'Check-out must be after check-in.');
      return;
    }

    if (editingBooking) {
      const updatedBooking: Booking = {
        ...editingBooking,
        customer: { ...editingBooking.customer, name: form.name, phone: form.phone, altPhone: form.altPhone || undefined },
        vehicle: {
          ...editingBooking.vehicle,
          plate: form.plate,
          province: form.province,
          brand: form.brand,
          model: form.model,
          type: form.carType,
        },
        checkIn: new Date(form.checkIn),
        checkOut: new Date(form.checkOut),
        fee: estimatedFee,
        remarks: form.remarks || undefined,
      };
      if (onEdit) onEdit(updatedBooking);
      onClose();
      return;
    }

    const zone = recommended;

    const claimedSlotIds = new Set(
      bookings
        .filter(b => b.status !== 'cancelled' && b.status !== 'completed')
        .map(b => b.slotId)
    );

    const zoneSlots = slots.filter(
      s => s.zone === zone && s.status === 'available' && !claimedSlotIds.has(s.id)
    );
    const slot =
      zoneSlots[0] ||
      slots.find(s => s.status === 'available' && !claimedSlotIds.has(s.id));

    // ไม่มีช่องว่างเลย → แจ้งเตือนและไม่ให้จอง
    if (!slot) {
      alert(lang === 'th'
        ? 'ขออภัย ขณะนี้ไม่มีช่องจอดว่าง ไม่สามารถเพิ่มการจองได้'
        : 'Sorry, there are no available parking slots right now.');
      return;
    }

    // generate random valid uuid v4
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    const newBooking: Booking = {
      id: uuid,
      slotId: slot.id,
      zone: slot.zone,
      slotNumber: slot.number,
      customer: { id: prefill?.customerId || `C-${Date.now()}`, name: form.name, phone: form.phone, altPhone: form.altPhone || undefined },
      vehicle: {
        plate: form.plate,
        province: form.province,
        brand: form.brand,
        model: form.model,
        type: form.carType,
      },
      checkIn: new Date(form.checkIn),
      checkOut: new Date(form.checkOut),
      fee: estimatedFee,
      status: 'confirmed',
      createdAt: new Date(),
      isWalkIn: true,
      remarks: form.remarks || undefined,
    };

    // จอง Walk-in จากหน้าประวัติ: ถ้าแก้ชื่อ/เบอร์จากโปรไฟล์เดิม ให้ถามก่อนว่าจะอัปเดตโปรไฟล์ไหม
    if (prefill && onUpdateCustomer && (form.name !== prefill.name || form.phone !== prefill.phone)) {
      const updateProfile = window.confirm(lang === 'th'
        ? 'ข้อมูลลูกค้าถูกแก้ไข — อัปเดตกลับเข้าโปรไฟล์ลูกค้าด้วยไหม?\n\nตกลง = อัปเดตโปรไฟล์\nยกเลิก = ใช้เฉพาะการจองครั้งนี้'
        : 'Customer info changed — also update the customer profile?\n\nOK = update profile\nCancel = this booking only');
      if (updateProfile) onUpdateCustomer(prefill.customerId, { name: form.name, phone: form.phone });
    }

    onAdd(newBooking);
    onClose();
  };

  const zoneColors: Record<Zone, string> = {
    A1: 'bg-purple-100 text-purple-700 border-purple-300',
    A2: 'bg-blue-100 text-blue-700 border-blue-300',
    B: 'bg-sky-100 text-sky-700 border-sky-300',
    C: 'bg-teal-100 text-teal-700 border-teal-300',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{editingBooking ? (lang === 'th' ? 'แก้ไขการจอง' : 'Edit Booking') : t.modal.addBooking}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.customerName}</label>
              <input 
                className="input-field" 
                value={form.name} 
                onChange={e => {
                  const val = e.target.value;
                  if (/^[a-zA-Z\u0E00-\u0E7F\s]*$/.test(val)) {
                    setForm({ ...form, name: val });
                  }
                }} 
                placeholder="สมชาย วงศ์ดี" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.phone}</label>
              <input 
                className="input-field" 
                value={form.phone} 
                onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} 
                placeholder="08x-xxx-xxxx" 
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.altPhone}</label>
              <input 
                className="input-field" 
                value={form.altPhone} 
                onChange={e => setForm({ ...form, altPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })} 
                placeholder="08x-xxx-xxxx" 
              />
            </div>
            {/* ลำดับ: ประเภทรถ → ยี่ห้อ → รุ่น → ทะเบียน → จังหวัด */}
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.carType}</label>
              <select className="input-field text-slate-500" value={form.carType} onChange={e => setForm({ ...form, carType: e.target.value as CarType })}>
                {Object.entries(t.modal.carTypes).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.brand}</label>
              <select
                className="input-field text-slate-500"
                value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value, model: '' })}
              >
                <option value="">{lang === 'th' ? 'เลือกยี่ห้อรถ' : 'Select brand'}</option>
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.model}</label>
              <select
                className="input-field text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                disabled={!form.brand}
              >
                <option value="">
                  {!form.brand
                    ? (lang === 'th' ? 'เลือกยี่ห้อก่อน' : 'Select brand first')
                    : (lang === 'th' ? 'เลือกรุ่นรถ' : 'Select model')}
                </option>
                {modelsForBrand.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.plate}</label>
              <input className="input-field" value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} placeholder="กข 1234" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.province}</label>
              <ProvinceCombobox
                value={form.province}
                onChange={p => setForm({ ...form, province: p })}
                placeholder={lang === 'th' ? 'พิมพ์ค้นหาจังหวัด...' : 'Search province...'}
              />
            </div>
          </div>

          {/* Recommended Zone */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <SparklesIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="text-xs text-slate-500">{t.modal.recommendedZone}:</span>
            <span className={`badge border ${zoneColors[recommended]} font-bold`}>
              Zone {recommended}
            </span>
            <span className="text-xs text-slate-400 ml-auto">
              {slots.filter(s => s.zone === recommended && s.status === 'available').length} {lang === 'th' ? 'ช่องว่าง' : 'slots free'}
            </span>
          </div>

          {/* Dates */}
          <div className="space-y-3">
            <ThaiDateTimePicker
              value={form.checkIn}
              onChange={v => {
                // ล็อกไม่ให้เลือกย้อนหลัง — ถ้าเลือกก่อนปัจจุบัน snap กลับมาเป็นเวลาปัจจุบัน
                const min = formatLocalDatetime(NOW);
                setForm({ ...form, checkIn: v < min ? min : v });
              }}
              label={t.modal.checkIn}
              lang={lang}
            />
            <ThaiDateTimePicker
              value={form.checkOut}
              onChange={v => {
                // วันออกต้องไม่ก่อนวันเข้า และไม่ย้อนหลัง
                const min = form.checkIn > formatLocalDatetime(NOW) ? form.checkIn : formatLocalDatetime(NOW);
                setForm({ ...form, checkOut: v < min ? min : v });
              }}
              label={t.modal.checkOut}
              lang={lang}
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">{t.modal.remarks}</label>
            <textarea
              className="input-field resize-none min-h-[80px]"
              value={form.remarks}
              onChange={e => {
                if (e.target.value.length <= 1000) {
                  setForm({ ...form, remarks: e.target.value });
                }
              }}
              placeholder={t.modal.remarksPlaceholder}
              maxLength={1000}
              rows={3}
            />
            {form.remarks.length > 0 && (
              <p className="text-[10px] text-slate-400 text-right mt-0.5">{form.remarks.length} / 1000</p>
            )}
          </div>

          {/* Estimated fee + ค่าบริการนอกเวลา (แยกบรรทัด ขาเข้า/ขาออก) */}
          {estimatedFee > 0 && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{lang === 'th' ? 'ค่าจอดรถ' : 'Parking'} ({rentalDays} {lang === 'th' ? 'วัน' : 'days'})</span>
                <span className="font-medium">฿{baseFee.toLocaleString()}</span>
              </div>
              {surchargeIn > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600">
                  <span>{lang === 'th' ? 'ค่าบริการนอกเวลา (ขาเข้า)' : 'Off-hours (check-in)'}</span>
                  <span className="font-medium">+฿{surchargeIn}</span>
                </div>
              )}
              {surchargeOut > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600">
                  <span>{lang === 'th' ? 'ค่าบริการนอกเวลา (ขาออก)' : 'Off-hours (check-out)'}</span>
                  <span className="font-medium">+฿{surchargeOut}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-blue-200 pt-1.5">
                <span className="text-sm text-blue-700 font-medium">{t.modal.estimatedFee}</span>
                <span className="text-xl font-bold text-blue-700">฿{estimatedFee.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">{t.modal.cancel}</button>
            <button onClick={handleSubmit} className="btn-primary flex-1 justify-center">{editingBooking ? (lang === 'th' ? 'บันทึกการแก้ไข' : 'Save Changes') : t.modal.confirm}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
