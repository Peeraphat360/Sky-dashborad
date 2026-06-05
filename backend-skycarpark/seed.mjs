import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jkibbcyrohqgbdvnljcx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraWJiY3lyb2hxZ2Jkdm5samN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4MzE5MywiZXhwIjoyMDk1MzU5MTkzfQ.uq1kpLlcmSQDgPpkyN6EBkX8KHgv9YeBLZBItut3IGI'
);

async function seed() {
  const { data: zones } = await supabase.from('parking_zones').insert([
    { name: 'A1', floor: 1 },
    { name: 'A2', floor: 1 },
    { name: 'B', floor: 1 },
    { name: 'C', floor: 2 },
  ]).select();

  console.log('Zones:', zones);

  const slots = [];
  for (const zone of zones) {
    for (let i = 1; i <= 10; i++) {
      slots.push({
        number: zone.name + '-' + String(i).padStart(3, '0'),
        status: 'AVAILABLE',
        zone_id: zone.id,
      });
    }
  }

  const { data: slotData } = await supabase.from('parking_slots').insert(slots).select();
  console.log('Slots created:', slotData.length);
}

seed().catch(console.error);
