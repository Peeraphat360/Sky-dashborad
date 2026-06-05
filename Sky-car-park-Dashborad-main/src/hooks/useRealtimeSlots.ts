import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

interface ParkingSlot {
  id:     string;
  number: string;
  status: SlotStatus;
  zone_id: string;
}

export function useRealtimeSlots() {
  const [slots, setSlots] = useState<ParkingSlot[]>([]);

  useEffect(() => {
    supabase
      .from('parking_slots')
      .select('*')
      .then(({ data }) => {
        if (data) setSlots(data);
      });

    const channel = supabase
      .channel('parking-slots')
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'parking_slots',
      }, (payload) => {
        setSlots(prev => prev.map(s =>
          s.id === payload.new.id ? payload.new as ParkingSlot : s
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { slots };
}
