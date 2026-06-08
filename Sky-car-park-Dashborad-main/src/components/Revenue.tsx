// src/components/Revenue.tsx
import React from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Booking, Language } from '../types';
import { translations } from '../data/i18n';
import { getMonthlyRevenue } from '../data/mockData';

interface RevenueProps {
  bookings: Booking[];
  lang: Language;
}

const ZONE_COLORS = ['#7c3aed', '#2563eb', '#0ea5e9', '#0d9488'];
const BOOKING_TYPE_COLORS = ['#2563eb', '#0ea5e9'];

export const Revenue: React.FC<RevenueProps> = ({ bookings, lang }) => {
  const t = translations[lang];

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const monthlyData = getMonthlyRevenue(bookings, currentYear);
  const monthlyDataLastYear = getMonthlyRevenue(bookings, lastYear);

  const combinedData = monthlyData.map((m, i) => ({
    ...m,
    revLastYear: monthlyDataLastYear[i].revenue,
    name: lang === 'th' ? m.month : m.monthEn,
  }));

  const yearlyRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const yearlyCount = monthlyData.reduce((s, m) => s + m.count, 0);
  const avgPerBooking = yearlyCount > 0 ? Math.round(yearlyRevenue / yearlyCount) : 0;

  // Zone revenue
  const completedBookings = bookings.filter(b => b.status === 'completed' && b.checkIn.getFullYear() === currentYear);
  const zoneRevenue = ['A1', 'A2', 'B', 'C'].map(zone => ({
    name: `Zone ${zone}`,
    value: completedBookings.filter(b => b.zone === zone).reduce((s, b) => s + b.fee, 0),
  })).filter(z => z.value > 0);

  // Booking type
  const walkInCount = completedBookings.filter(b => b.isWalkIn).length;
  const onlineCount = completedBookings.filter(b => !b.isWalkIn).length;
  const bookingTypeData = [
    { name: t.revenue.online, value: onlineCount },
    { name: t.revenue.walkIn, value: walkInCount },
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
          <p className="font-bold text-slate-700 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }}>
              {p.name}: ฿{Number(p.value).toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className='mt-14 md:mt-0'>
        <h1 className="text-xl font-bold text-slate-800">{t.revenue.title}</h1>
        <p className="text-sm text-slate-400 mt-0.5">{lang === 'th' ? `ปี ${currentYear + 543}` : `Year ${currentYear}`}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="card p-4 md:p-5">
          <p className="text-xs text-slate-400 mb-1">{t.revenue.yearlyRevenue}</p>
          <p className="text-2xl font-bold text-blue-600">฿{yearlyRevenue.toLocaleString()}</p>
        </div>
        <div className="card p-4 md:p-5">
          <p className="text-xs text-slate-400 mb-1">{t.revenue.totalBookings}</p>
          <p className="text-2xl font-bold text-slate-700">{yearlyCount}</p>
        </div>
        <div className="card p-4 md:p-5">
          <p className="text-xs text-slate-400 mb-1">{t.revenue.avgPerBooking}</p>
          <p className="text-2xl font-bold text-emerald-600">฿{avgPerBooking.toLocaleString()}</p>
        </div>
      </div>

      {/* Bar chart - monthly */}
      <div className="card p-4 md:p-5">
        <h2 className="font-bold text-slate-700 text-sm mb-4">{t.revenue.monthly}</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={combinedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name={lang === 'th' ? `ปี ${currentYear + 543}` : `${currentYear}`} fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="revLastYear" name={lang === 'th' ? `ปี ${lastYear + 543}` : `${lastYear}`} fill="#bfdbfe" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Line chart */}
        <div className="card p-4 md:p-5 md:col-span-3">
          <h2 className="font-bold text-slate-700 text-sm mb-4">{lang === 'th' ? 'แนวโน้มรายได้' : 'Revenue Trend'}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={combinedData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} name={lang === 'th' ? 'รายได้' : 'Revenue'} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Donut charts */}
        <div className="md:col-span-2 grid grid-cols-1 gap-4">
          {/* Zone donut */}
          <div className="card p-4">
            <h2 className="font-bold text-slate-700 text-sm mb-3">{t.revenue.zoneRevenue}</h2>
            <div className="flex items-center">
              <PieChart width={100} height={100}>
                <Pie data={zoneRevenue} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" label={false}>
                  {zoneRevenue.map((_, i) => (
                    <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-1 pl-1">
                {zoneRevenue.map((z, i) => (
                  <div key={z.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ZONE_COLORS[i] }} />
                      <span className="text-slate-600">{z.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700">฿{z.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking type donut */}
          <div className="card p-4">
            <h2 className="font-bold text-slate-700 text-sm mb-3">{t.revenue.bookingType}</h2>
            <div className="flex items-center">
              <PieChart width={100} height={90}>
                <Pie data={bookingTypeData} cx="50%" cy="50%" innerRadius={25} outerRadius={43} dataKey="value">
                  {bookingTypeData.map((_, i) => (
                    <Cell key={i} fill={BOOKING_TYPE_COLORS[i]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2 pl-1">
                {bookingTypeData.map((d, i) => (
                  <div key={d.name} className="flex items-center text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: BOOKING_TYPE_COLORS[i] }} />
                      <span className="text-slate-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-700 ml-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};