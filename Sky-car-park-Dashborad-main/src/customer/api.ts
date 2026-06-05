// Tiny fetch helper for the customer LINE-auth flow.
// credentials:'include' is required so the browser sends the session cookie set
// by the NestJS backend after LINE login.
export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001';

export interface LineUser {
  lineId: string;
  displayName: string;
}

export interface ConfirmBookingPayload {
  slotId: string;
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
  vehiclePlate: string;
  vehicleProvince?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleType?: string;
  customerPhone?: string;
  fee?: number;
  remarks?: string;
}

/** GET /auth/me — resolves to the LINE user, or null if not authenticated. */
export async function fetchMe(): Promise<LineUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
  return res.json();
}

/** POST /auth/logout — clears the session. */
export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
}

/** POST /bookings/confirm — the call that finally persists the LINE user + booking. */
export async function confirmBooking(payload: ConfirmBookingPayload) {
  const res = await fetch(`${API_BASE}/bookings/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message || `Booking failed: ${res.status}`);
  }
  return res.json() as Promise<{ bookingId: string; status: string; userId: string }>;
}

/** Where the "Log in with LINE" button sends the browser (top-level redirect). */
export const LINE_LOGIN_URL = `${API_BASE}/auth/line`;
