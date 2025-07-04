// supabase.js
const SUPABASE_URL = 'https://wrcoawxhvyduinkzwsgc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhenVyZmJtcm5zYWRrcnh1dHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2NTY0NzEsImV4cCI6MjA2NzIzMjQ3MX0.GmBk4XRX0gVhw20gTGX8jM58mb2gXOFC7qkY8iMEU9k';

// ✅ El objeto global es `supabase`, ya definido por el SDK UMD
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
