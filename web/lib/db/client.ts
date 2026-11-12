import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// browser client. anon key, read + realtime only.
let cached: SupabaseClient | null = null;

export function browserDb(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}
