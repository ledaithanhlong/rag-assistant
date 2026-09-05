import { createClient } from '@supabase/supabase-js';

// Dùng service_role key: chỉ chạy phía server (API routes), bỏ qua RLS.
// KHÔNG BAO GIỜ import file này vào component phía client ('use client').
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
