import React, { useState, useRef, useEffect } from 'react';
import { THAI_PROVINCES } from '../data/provinces';

interface ProvinceComboboxProps {
  value: string;
  onChange: (province: string) => void;
  placeholder?: string;
}

// ช่องค้นหาจังหวัดแบบพิมพ์ได้ — พิมพ์แล้วกรองรายชื่อจังหวัดที่ตรงขึ้นมาให้เลือก
export const ProvinceCombobox: React.FC<ProvinceComboboxProps> = ({ value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  // sync ค่าจากภายนอก (เช่น ตอนแก้ไข booking)
  useEffect(() => { setQuery(value); }, [value]);

  // คลิกนอกกล่อง → ปิด dropdown
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const q = query.trim();
  const matches = q
    ? THAI_PROVINCES.filter(p => p.includes(q)).slice(0, 8)
    : THAI_PROVINCES.slice(0, 8);

  const pick = (p: string) => {
    onChange(p);
    setQuery(p);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className="input-field"
        value={query}
        placeholder={placeholder}
        onChange={e => {
          setQuery(e.target.value);
          onChange(e.target.value);   // เก็บค่าที่พิมพ์ไว้ด้วย (เผื่อพิมพ์เอง)
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map(p => (
            <li key={p}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                className={`w-full text-left px-3.5 py-2 text-sm hover:bg-blue-50 transition-colors ${
                  p === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                }`}
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
