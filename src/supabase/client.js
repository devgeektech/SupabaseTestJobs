import { createClient } from "@supabase/supabase-js";

export function makeSupabase(userJwt) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: userJwt ? { Authorization: `Bearer ${userJwt}` } : undefined,
      },
    }
  );
}

// Admin/service client: bypasses RLS. Never expose this key to clients.
export function makeServiceSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
