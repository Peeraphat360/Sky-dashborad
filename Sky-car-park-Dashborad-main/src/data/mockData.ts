import { Booking, Zone } from '../types';

export const NOW = new Date();

export interface FeeBreakdown {
  baseFee: number;
  overMinutes: number;
  overCategory: 'none' | 'grace' | 'partial' | 'extra_day';
  surcharge: number;
  totalFee: number;
}

export function calcFee(
  baseFee: number,
  checkIn: Date,
  scheduledCheckout: Date,
  actualNow: Date,
): FeeBreakdown {
  const overMs = actualNow.getTime() - scheduledCheckout.getTime();
  const overMinutes = Math.floor(overMs / 60000);

  const bookedDays = Math.max(1, Math.ceil(
    (scheduledCheckout.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
  ));
  const dailyRate = Math.round(baseFee / bookedDays);

  if (overMinutes <= 0) {
    return { baseFee, overMinutes: 0, overCategory: 'none', surcharge: 0, totalFee: baseFee };
  }
  if (overMinutes <= 120) {
    return { baseFee, overMinutes, overCategory: 'grace', surcharge: 0, totalFee: baseFee };
  }
  if (overMinutes <= 360) {
    const total = Math.round(baseFee * 1.5);
    return { baseFee, overMinutes, overCategory: 'partial', surcharge: total - baseFee, totalFee: total };
  }
  const total = baseFee + dailyRate;
  return { baseFee, overMinutes, overCategory: 'extra_day', surcharge: dailyRate, totalFee: total };
}

export function recommendZone(carType: string): Zone {
  if (carType === 'supercar') return 'A1';
  if (carType === 'sedan' || carType === 'ev') return 'A2';
  if (carType === 'van' || carType === 'pickup' || carType === 'pickup_closed') return 'C';
  return 'B';
}

export function getMonthlyRevenue(bookings: Booking[], year: number) {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((m, i) => {
    const bks = bookings.filter(
      b => b.status === 'completed' && b.checkIn.getFullYear() === year && b.checkIn.getMonth() === i
    );
    return {
      month: m,
      monthEn: monthsEn[i],
      revenue: bks.reduce((s, b) => s + b.fee, 0),
      count: bks.length
    };
  });
}

export type BookingStatus = Booking['status'];
