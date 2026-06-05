import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jkibbcyrohqgbdvnljcx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpraWJiY3lyb2hxZ2Jkdm5samN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4MzE5MywiZXhwIjoyMDk1MzU5MTkzfQ.uq1kpLlcmSQDgPpkyN6EBkX8KHgv9YeBLZBItut3IGI'
);

async function seedUsers() {
  const { data, error } = await supabase.from('users').insert([
    {
      email: 'walkin@skycarpark.com',
      password: 'walkin',
      name: 'Walk-in Customer',
      role: 'CUSTOMER',
    }
  ]).select();
  
  console.log('User created:', data);
  if (error) console.error('Error:', error);
}

seedUsers();
