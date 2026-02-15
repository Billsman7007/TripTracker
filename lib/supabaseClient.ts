import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  let SUPABASE_URL =
    (typeof window !== "undefined" && (window as any).__ENV__?.EXPO_PUBLIC_SUPABASE_URL) ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "";

  let SUPABASE_ANON_KEY =
    (typeof window !== "undefined" && (window as any).__ENV__?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  // Strip quotes if .env parser left them
  SUPABASE_URL = SUPABASE_URL.replace(/^"|"$/g, "").trim();
  SUPABASE_ANON_KEY = SUPABASE_ANON_KEY.replace(/^"|"$/g, "").trim();

  // Return existing client if available
  if (_supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return _supabase;
  }

  // During build time, env vars might not be available -- create a placeholder
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (typeof window === "undefined") {
      if (!_supabase) {
        _supabase = createClient("https://placeholder.supabase.co", "placeholder-key");
      }
      return _supabase;
    }
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Check your .env file and restart the dev server."
    );
  }

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

// Export a lazy-initializing proxy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = getSupabaseClient();
    }
    const value = (_supabase as any)[prop];
    if (typeof value === "function") {
      return value.bind(_supabase);
    }
    return value;
  },
});
