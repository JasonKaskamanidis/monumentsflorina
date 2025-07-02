import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://rkakirxzspxmupunshcq.supabase.co'; // <-- Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrYWtpcnh6c3B4bXVwdW5zaGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyODk5MzQsImV4cCI6MjA2Njg2NTkzNH0.UmGMKWA7JZl6YmJT1qjeicEk0xFRP3fjXbiBYfCprew'; // <-- Replace with your anon/public key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
