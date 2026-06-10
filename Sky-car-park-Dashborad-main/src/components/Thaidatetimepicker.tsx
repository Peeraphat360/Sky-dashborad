import React, { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ThaiDateTimePickerProps {
  value: string; // ISO datetime-local string: "2026-05-18T14:30"
  onChange: (value: string) => void;
  label?: string;
  lang?: 'th' | 'en';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const THAI_MONTHS_SHORT = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'
];
const EN_MONTHS_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
];

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const DRUM_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// ─── Drum Roller ─────────────────────────────────────────────────────────────
interface DrumProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width?: number;
}

const DrumRoller: React.FC<DrumProps> = ({ items, selectedIndex, onSelect, width = 72 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const animFrame = useRef<number>();
  const velocityRef = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);

  // Scroll to selectedIndex
  const scrollToIndex = useCallback((index: number, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const target = index * ITEM_HEIGHT;
    if (smooth) {
      el.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      el.scrollTop = target;
    }
  }, []);

  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rawIndex = el.scrollTop / ITEM_HEIGHT;
    const snapped = Math.round(rawIndex);
    const clamped = Math.max(0, Math.min(items.length - 1, snapped));
    scrollToIndex(clamped);
    onSelect(clamped);
  }, [items.length, onSelect, scrollToIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    isDragging.current = true;
    startY.current = e.clientY;
    startScrollTop.current = el.scrollTop;
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    velocityRef.current = 0;
    el.setPointerCapture(e.pointerId);
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const now = Date.now();
    const dt = now - lastTime.current;
    const dy = e.clientY - lastY.current;
    if (dt > 0) velocityRef.current = dy / dt;
    lastY.current = e.clientY;
    lastTime.current = now;
    el.scrollTop = startScrollTop.current - (e.clientY - startY.current);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // Momentum
    const el = containerRef.current;
    if (!el) return;
    let v = velocityRef.current * -15;
    const momentum = () => {
      if (Math.abs(v) < 0.5) { snapToNearest(); return; }
      el.scrollTop += v;
      v *= 0.85;
      animFrame.current = requestAnimationFrame(momentum);
    };
    animFrame.current = requestAnimationFrame(momentum);
  };

  return (
    <div style={{ width, position: 'relative', flexShrink: 0 }}>
      {/* Gradient overlays */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: `linear-gradient(to bottom,
          rgba(255,255,255,0.95) 0%,
          rgba(255,255,255,0.5) 25%,
          transparent 40%,
          transparent 60%,
          rgba(255,255,255,0.5) 75%,
          rgba(255,255,255,0.95) 100%
        )`,
        borderRadius: 12,
      }} />
      {/* Selection highlight */}
      <div style={{
        position: 'absolute', left: 4, right: 4, zIndex: 1,
        top: ITEM_HEIGHT * 2,
        height: ITEM_HEIGHT,
        background: 'rgba(59,130,246,0.08)',
        borderRadius: 10,
        border: '1.5px solid rgba(59,130,246,0.2)',
        pointerEvents: 'none',
      }} />

      {/* Scrollable drum */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          height: DRUM_HEIGHT,
          overflowY: 'scroll',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          borderRadius: 12,
          position: 'relative',
          zIndex: 0,
        }}
      >
        {/* Padding spacers */}
        <div style={{ height: ITEM_HEIGHT * 2 }} />
        {items.map((item, i) => (
          <div
            key={i}
            onClick={() => { scrollToIndex(i); onSelect(i); }}
            style={{
              height: ITEM_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: i === selectedIndex ? 17 : 15,
              fontWeight: i === selectedIndex ? 700 : 400,
              color: i === selectedIndex ? '#1e40af' : '#94a3b8',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              letterSpacing: i === selectedIndex ? '0.01em' : '0',
            }}
          >
            {item}
          </div>
        ))}
        <div style={{ height: ITEM_HEIGHT * 2 }} />
      </div>
    </div>
  );
};

// ─── Parse helpers ────────────────────────────────────────────────────────────
function parseValue(value: string): { year: number; month: number; day: number; hour: number; minute: number } {
  if (!value) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate(), hour: now.getHours(), minute: now.getMinutes() };
  }
  const [datePart, timePart] = value.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = (timePart || '00:00').split(':').map(Number);
  return { year: y, month: mo - 1, day: d, hour: h, minute: mi };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function toOutputString(year: number, month: number, day: number, hour: number, minute: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

// ─── Main Picker ──────────────────────────────────────────────────────────────
export const ThaiDateTimePicker: React.FC<ThaiDateTimePickerProps> = ({
  value,
  onChange,
  label,
  lang = 'th',
}) => {
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);

  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);

  // Re-sync when value changes externally
  useEffect(() => {
    const p = parseValue(value);
    setYear(p.year); setMonth(p.month); setDay(p.day);
    setHour(p.hour); setMinute(p.minute);
  }, [value]);

  const months = lang === 'th' ? THAI_MONTHS_SHORT : EN_MONTHS_SHORT;
  const maxDay = daysInMonth(year, month);
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  // เลือกนาทีทีละ 5 (00, 05, 10, ..., 55)
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  // Clamp day when month/year changes
  useEffect(() => {
    const max = daysInMonth(year, month);
    if (day > max) setDay(max);
  }, [year, month, day]);

  // ถ้านาทีเริ่มต้นไม่ลงตัว 5 (เช่น booking เก่า :43) → ปัดเป็นใกล้สุด (:45)
  useEffect(() => {
    if (minute % 5 !== 0) setMinute(Math.min(11, Math.round(minute / 5)) * 5);
  }, [minute]);

  const handleConfirm = () => {
    const out = toOutputString(year, month, day, hour, minute);
    onChange(out);
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset to original value
    const p = parseValue(value);
    setYear(p.year); setMonth(p.month); setDay(p.day);
    setHour(p.hour); setMinute(p.minute);
    setOpen(false);
  };

  // Display value
  const displayValue = () => {
    if (!value) return lang === 'th' ? 'เลือกวัน/เวลา' : 'Select date/time';
    const p = parseValue(value);
    const d = new Date(p.year, p.month, p.day, p.hour, p.minute);
    if (lang === 'th') {
      const buddhistYear = p.year + 543;
      const mo = THAI_MONTHS_SHORT[p.month];
      const hh = String(p.hour).padStart(2,'0');
      const mm = String(p.minute).padStart(2,'0');
      return `${p.day} ${mo} ${buddhistYear}  ${hh}:${mm} น.`;
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      `  ${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
  };

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: '#64748b',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1.5px solid #e2e8f0',
          background: open ? '#f0f7ff' : '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 0.15s ease',
          boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.15)' : 'none',
        }}
      >
        <span style={{
          flex: 1,
          fontSize: 14,
          fontWeight: value ? 500 : 400,
          color: value ? '#334155' : '#94a3b8',
          fontFamily: 'inherit',
        }}>
          {displayValue()}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>▼</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={handleCancel}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              borderRadius: '20px 20px 0 0',
              overflow: 'hidden',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)',
            }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>

            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
            </div>

            {/* Header */}
            <div style={{
              padding: '12px 20px 10px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                onClick={handleCancel}
                style={{
                  fontSize: 14, color: '#64748b', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: 8, fontFamily: 'inherit',
                }}
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>
                {lang === 'th' ? 'เลือกวัน / เวลา' : 'Select Date & Time'}
              </span>
              <button
                onClick={handleConfirm}
                style={{
                  fontSize: 14, color: '#2563eb', fontWeight: 700,
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: 8, fontFamily: 'inherit',
                }}
              >
                {lang === 'th' ? 'ตกลง' : 'Done'}
              </button>
            </div>

            {/* Section labels */}
            <div style={{
              display: 'flex',
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 10,
              gap: 6,
              justifyContent: 'center',
            }}>
              {[
                { label: lang === 'th' ? 'วัน' : 'Day', width: 52 },
                { label: lang === 'th' ? 'เดือน' : 'Month', width: 68 },
                { label: '', width: 10 },
                { label: lang === 'th' ? 'ชั่วโมง' : 'Hour', width: 62 },
                { label: '', width: 14, isColon: true },
                { label: lang === 'th' ? 'นาที' : 'Min', width: 62 },
              ].map((col, i) => (
                <div key={i} style={{
                  width: col.width,
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}>
                  {col.isColon ? '' : col.label}
                </div>
              ))}
            </div>

            {/* Drums */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px 16px',
              justifyContent: 'center',
            }}>
              {/* Day */}
              <DrumRoller
                items={days}
                selectedIndex={day - 1}
                onSelect={i => setDay(i + 1)}
                width={52}
              />
              {/* Month */}
              <DrumRoller
                items={months}
                selectedIndex={month}
                onSelect={i => setMonth(i)}
                width={68}
              />

              {/* Divider */}
              <div style={{
                width: 10, fontSize: 22, color: '#cbd5e1', fontWeight: 300,
                textAlign: 'center', flexShrink: 0, alignSelf: 'center',
              }}>·</div>

              {/* Hour */}
              <DrumRoller
                items={hours}
                selectedIndex={hour}
                onSelect={i => setHour(i)}
                width={62}
              />

              {/* Colon */}
              <div style={{
                fontSize: 22, fontWeight: 700, color: '#cbd5e1',
                alignSelf: 'center', flexShrink: 0, letterSpacing: '-2px',
                width: 14, textAlign: 'center',
              }}>:</div>

              {/* Minute (ทีละ 5 นาที) */}
              <DrumRoller
                items={minutes}
                selectedIndex={Math.min(11, Math.round(minute / 5))}
                onSelect={i => setMinute(i * 5)}
                width={62}
              />
            </div>

            {/* Live preview */}
            <div style={{
              margin: '0 16px 20px',
              padding: '10px 16px',
              background: '#f0f7ff',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 13, color: '#3b82f6' }}>📅</span>
              <span style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1d4ed8',
                letterSpacing: '0.01em',
              }}>
                {(() => {
                  const maxD = daysInMonth(year, month);
                  const clampedDay = Math.min(day, maxD);
                  if (lang === 'th') {
                    const buddhistYear = year + 543;
                    return `${clampedDay} ${THAI_MONTHS_SHORT[month]} ${buddhistYear}  ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} น.`;
                  }
                  return `${clampedDay} ${EN_MONTHS_SHORT[month]} ${year}  ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Updated AddBookingModal (check-in/out section only — drop-in replacement) ─
/*
  USAGE in AddBookingModal.tsx:
  Replace the "Dates" section:

    import { ThaiDateTimePicker } from './ThaiDateTimePicker';

    // Replace this block:
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label ...>{t.modal.checkIn}</label>
        <input type="datetime-local" ... />
      </div>
      <div>
        <label ...>{t.modal.checkOut}</label>
        <input type="datetime-local" ... />
      </div>
    </div>

    // With this:
    <div className="space-y-3">
      <ThaiDateTimePicker
        value={form.checkIn}
        onChange={v => setForm({ ...form, checkIn: v })}
        label={t.modal.checkIn}
        lang={lang}
      />
      <ThaiDateTimePicker
        value={form.checkOut}
        onChange={v => setForm({ ...form, checkOut: v })}
        label={t.modal.checkOut}
        lang={lang}
      />
    </div>
*/

export default ThaiDateTimePicker;