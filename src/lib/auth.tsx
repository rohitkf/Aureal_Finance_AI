/* eslint-disable react-refresh/only-export-components -- the provider and its hook belong together. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthValue {
  session: Session | null;
  user: User | null;
  /** True until the stored session has been checked, so guards don't flash. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Rethrows the error as it came, rather than flattening it to a string.
 *
 * It used to be converted here, which threw away the error code and left the
 * caller with prose it could not classify. Describing it is the screen's job —
 * `describeError` — because only the screen knows what the person was trying
 * to do, and only it can decide whether to show the underlying detail.
 */
const raise = (error: unknown): never => {
  throw error instanceof Error ? error : new Error(String(error));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) raise(error);
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Picked up by the handle_new_user trigger to name the profile.
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) raise(error);
    // With email confirmation on, Supabase returns a user but no session.
    return { needsConfirmation: Boolean(data.user) && !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) raise(error);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) raise(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) raise(error);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [session, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

/** Minimum we ask of a password, checked before the round trip. */
export const passwordProblem = (password: string): string | undefined => {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.';
  }
  return undefined;
};
