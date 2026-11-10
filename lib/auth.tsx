import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Login for Savify — powered by free Supabase Auth.
 *
 * The hooks below (useAuth / useUser / useClerk) keep the same shape the app
 * used with Clerk, so screens didn't need to be rewritten.
 */

export type AppUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  primaryEmailAddress: { emailAddress: string };
  emailAddresses: { emailAddress: string }[];
  /** Change password (checks the current one first). */
  updatePassword: (p: { currentPassword: string; newPassword: string }) => Promise<void>;
  /** Permanently delete the account and all data. */
  delete: () => Promise<void>;
};

type AuthState = {
  isLoaded: boolean;
  session: Session | null;
};

const Ctx = createContext<AuthState>({ isLoaded: false, session: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ isLoaded: false, session: null });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (mounted) setState({ isLoaded: true, session: data.session }); })
      .catch(() => { if (mounted) setState({ isLoaded: true, session: null }); });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ isLoaded: true, session });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

async function signOut() {
  try { await supabase.auth.signOut(); } catch { /* already signed out */ }
}

function toAppUser(u: User): AppUser {
  const email = (u.email ?? "").toLowerCase();
  return {
    id: u.id,
    email,
    emailVerified: !!u.email_confirmed_at,
    createdAt: u.created_at,
    primaryEmailAddress: { emailAddress: email },
    emailAddresses: [{ emailAddress: email }],
    updatePassword: async ({ currentPassword, newPassword }) => {
      const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (check.error) throw new Error("Your current password is not correct.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    delete: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await AsyncStorage.multiRemove([`setup_seen_${u.id}`]).catch(() => {});
      await signOut();
    },
  };
}

export function useAuth() {
  const { isLoaded, session } = useContext(Ctx);
  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);
  return {
    isLoaded,
    isSignedIn: !!session,
    userId: session?.user.id ?? null,
    sessionId: session ? (session.user.id + ":" + (session.user.last_sign_in_at ?? "")) : null,
    getToken,
    signOut,
  };
}

export function useUser() {
  const { isLoaded, session } = useContext(Ctx);
  const user = useMemo(() => (session?.user ? toAppUser(session.user) : null), [session?.user]);
  return { isLoaded, isSignedIn: !!session, user };
}

/** Same name as before so older screens keep working. */
export function useClerk() {
  return { signOut };
}
