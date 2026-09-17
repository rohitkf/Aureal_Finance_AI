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
