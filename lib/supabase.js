import { createClient as _createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = _createClient(supabaseUrl, supabaseAnonKey);

// narrative-tracker 등에서 createClient()로 호출할 수 있도록
export function createClient() {
  return supabase;
}
