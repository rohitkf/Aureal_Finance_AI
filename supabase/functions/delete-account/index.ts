/**
 * Deleting your own account, for good.
 *
 * This cannot be done from the browser. Removing a row from `auth.users` needs
 * the service role key, and that key must never reach a bundle — this repo is
 * public and every `VITE_*` variable is inlined into the JavaScript the
 * browser downloads. So the privileged half lives here, where the key is read
 * from the function's own environment and never leaves it.
 *
 * The one rule this file exists to enforce: **the id deleted is the id in the
 * verified token, never one supplied by the caller.** A body parameter here
 * would be an endpoint for deleting other people's accounts. There is no body.
 *
 * Everything the person owns is reached by a cascade. Every table in `public`
 * has `user_id references auth.users on delete cascade`, and
 * `transaction_splits` cascades from `transactions`, so one delete takes all
 * of it. Deleting the rows first and the user second would work too, and would
 * be a second list of tables to keep in step with the schema.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  // Named differently on newer projects; either is the same privileged key.
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !serviceKey) {
    // Said plainly rather than as a 500 with no cause: this is a deployment
    // fault, and the person deleting their account can do nothing about it.
    return json({ error: 'This server is missing its credentials. Nothing was deleted.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in.' }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Who the token actually belongs to. `verify_jwt` on the function already
  // refuses an unsigned or expired one; this is what turns a valid token into
  // the single id that may be deleted.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return json({ error: 'That session is no longer valid.' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ deleted: true }, 200);
});
