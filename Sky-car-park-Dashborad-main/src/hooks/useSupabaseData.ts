import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseData() {
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);

    const { data: slotsData } = await supabase
      .from('parking_slots')
      .select('*, parking_zones(*)');

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (slotsData) setSlots(slotsData);
    if (bookingsData) setBookings(bookingsData);
    setLoading(false);
  }

  async function addBooking(data: any) {
    const { error } = await supabase.from('bookings').insert(data);
    if (!error) fetchAll();
  }

  async function updateBooking(id: string, data: any) {
    const { error } = await supabase.from('bookings').update(data).eq('id', id);
    if (!error) fetchAll();
  }

  async function updateSlot(id: string, data: any) {
    const { error } = await supabase.from('parking_slots').update(data).eq('id', id);
    if (!error) fetchAll();
  }

  return { slots, bookings, loading, addBooking, updateBooking, updateSlot, refetch: fetchAll };
}
