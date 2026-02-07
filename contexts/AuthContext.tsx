import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "expo-router";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    console.log("[AuthContext] Initializing...");

    // Timeout to prevent infinite loading - very short for mobile
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[AuthContext] Loading timeout - proceeding anyway");
        setLoading(false);
      }
    }, 1500); // 1.5 second timeout

    // Get initial session
    console.log("[AuthContext] Calling getSession...");
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) {
        console.log("[AuthContext] Component unmounted, ignoring session");
        return;
      }
      clearTimeout(timeout);
      if (error) {
        console.error("[AuthContext] Error getting session:", error);
        setLoading(false);
        return;
      }
      console.log("[AuthContext] Session retrieved:", session ? "Logged in" : "Not logged in");
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error("[AuthContext] Exception in getSession:", error);
      clearTimeout(timeout);
      if (mounted) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      console.log("[AuthContext] Auth state changed:", _event, session ? "Logged in" : "Not logged in");
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log("[AuthContext] Cleaning up...");
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Removed navigation logic - let individual screens handle their own navigation
  // This prevents infinite reload loops

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
