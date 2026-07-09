import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchProfile } from './api';
import { Profile } from './types';
import { SITE_URL } from './constants';

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// Turn Supabase's terse auth errors into friendly copy, same mapping as the site.
function friendlyAuthError(msg?: string): string {
  if (!msg) return 'Something went wrong. Try again?';
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/already registered/i.test(msg)) return 'An account with that email already exists. Try signing in.';
  if (/password.*6/i.test(msg)) return 'Password needs to be at least 6 characters.';
  if (/email not confirmed/i.test(msg)) return 'Check your inbox. You need to verify your email before signing in.';
  return msg;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u: User | null) {
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await fetchProfile(u.id));
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      loadProfile(u).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      loadProfile(u);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Email-confirm links open the live site, which confirms the account.
      options: { emailRedirectTo: SITE_URL },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    return { needsConfirm: !data.session };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
    if (error) throw new Error(friendlyAuthError(error.message));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      profile,
      isAdmin: !!profile?.is_admin,
      loading,
      refreshProfile: () => loadProfile(user),
      signIn,
      signUp,
      resetPassword,
      signOut,
    }),
    [user, profile, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
