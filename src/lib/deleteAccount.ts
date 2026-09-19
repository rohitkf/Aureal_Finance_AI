import { UserFacingError } from './errors';
import { supabase } from './supabase';

/**
 * Deleting your own account.
 *
 * The browser cannot do this. Removing a row from `auth.users` needs the
 * service role key, and that key must never reach a bundle — this repo is
 * public and every `VITE_*` variable is inlined into the JavaScript the
 * browser downloads. So the privileged half is an edge function, and this is
 * the half that asks it.
 *
 * It sends no user id. The function reads the id out of the verified token and
 * deletes that one, which is what stops the endpoint being a way to delete
 * somebody else's account. Nothing here would make that safe, so nothing here
 * tries.
 *
 * Everything the person owns goes with the user row: every table in `public`
 * has `user_id references auth.users on delete cascade`, and splits cascade
 * from their transaction.
 */
export const deleteAccount = async (): Promise<void> => {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new UserFacingError(sessionError.message);

  const token = data.session?.access_token;
  if (!token) throw new UserFacingError('You are not signed in any more. Sign in again and try once more.');

  const { data: result, error } = await supabase.functions.invoke<{ deleted?: boolean }>(
    'delete-account',
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (error) {
    // `FunctionsHttpError` carries the real reason in a response body the
    // caller has to read for itself; without this every failure reads
    // "Edge Function returned a non-2xx status code", which tells nobody
    // whether their account was deleted.
    const detail = await readError(error);
    throw new UserFacingError(detail ?? 'The account could not be deleted. Nothing has been removed.');
  }

  if (!result?.deleted) {
    throw new UserFacingError('The server did not confirm the deletion. Nothing has been removed.');
  }
};

/** Digs the server's own sentence out of a failed function call, if there is one. */
const readError = async (error: unknown): Promise<string | undefined> => {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body.error === 'string') return body.error;
    } catch {
      // A non-JSON body tells us nothing useful; fall through to the default.
    }
  }
  return error instanceof Error ? error.message : undefined;
};
