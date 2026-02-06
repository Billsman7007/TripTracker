import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  // Try multiple sources for environment variables
  // 1. process.env (build-time, embedded by Expo)
  // 2. window.__ENV__ (runtime injection, if available)
  
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
  
  // Debug logging (always log in browser to help diagnose)
  if (typeof window !== "undefined") {
    console.log("[Supabase Client] Initializing...");
    console.log("[Supabase Client] URL:", SUPABASE_URL ? `${SUPABASE_URL.substring(0, 30)}...` : "(empty)");
    console.log("[Supabase Client] Key:", SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 20)}...` : "(empty)");
  }

  // Check if we already have a client initialized
  if (_supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return _supabase;
  }

  // During build time (static export), env vars might not be available
  // Create a placeholder client that won't throw during build
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Check if we're in a Node.js build context (not browser runtime)
    if (typeof window === "undefined") {
      // During build, create a minimal client that won't throw
      if (!_supabase) {
        _supabase = createClient("https://placeholder.supabase.co", "placeholder-key");
      }
      return _supabase;
    }
    // At runtime in browser, provide a helpful error message
    const errorMsg = `Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.
    
Please ensure these environment variables are set:
1. Create a .env file in the project root
2. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
3. Restart the dev server

Current values:
- EXPO_PUBLIC_SUPABASE_URL: ${SUPABASE_URL || "(empty)"}
- EXPO_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? "(set)" : "(empty)"}`;
    
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Always create a new client with the current credentials
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Log for debugging
  if (typeof window !== "undefined") {
    console.log("[Supabase Client] Created client successfully");
  }
  
  return _supabase;
}

// Export a getter that lazily initializes the client
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
  }
});
