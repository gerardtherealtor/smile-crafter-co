import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "employee" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  roleLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  role: null,
  loading: true,
  roleLoading: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  const fetchRole = async (userId: string) => {
    setRoleLoading(true);
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (data && data.length > 0) {
        const isAdmin = data.some((r) => r.role === "admin");
        setRole(isAdmin ? "admin" : "employee");
      } else {
        setRole(null);
      }
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    // Set listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setRoleLoading(true);
        setTimeout(() => fetchRole(newSession.user.id), 0);
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, roleLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
