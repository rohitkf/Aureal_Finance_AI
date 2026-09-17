import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * True when the app has been given somewhere to talk to. The UI checks this so
 * a missing environment variable produces a clear message rather than a stack
 * trace on a blank screen.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
  );
}

/**
 * The browser client. The publishable key is designed to ship in a bundle —
 * every table is protected by row-level security, so this key alone grants
 * nothing beyond what the signed-in user owns.
 */
export const supabase = createClient(url ?? 'http://localhost', publishableKey ?? 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

/** Turns a Supabase error into something worth showing a person. */
export const friendlyAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match an account.';
  if (m.includes('email not confirmed')) return 'Check your inbox and confirm your email address first.';
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (m.includes('password should be at least')) return 'Passwords need to be at least 8 characters.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Couldn’t reach the server. Check your connection and try again.';
  }
  return message;
};
