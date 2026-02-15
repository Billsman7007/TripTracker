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

    // Timeout to prevent infinite loading on slow connections
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 3000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      clearTimeout(timeout);
      if (error) {
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
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
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

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
