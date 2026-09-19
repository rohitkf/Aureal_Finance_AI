import { isDevMode } from './devMode';

/**
 * Turning whatever went wrong into something a person can act on.
 *
 * The rule is that the interface never shows a user a sentence written for a
 * developer. `duplicate key value violates unique constraint
 * "categories_user_name_kind_key"` tells somebody adding a category nothing
 * they can use, and tells an attacker the shape of the schema.
 *
 * Development mode, which is a switch in Settings, shows the underlying error
 * instead — the whole point being that it is available on the live site, where
 * the problem actually happened, rather than only in a local build.
 */

/** The shape supabase-js returns for a PostgREST failure. */
interface PostgrestLike {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

/**
 * An error whose message is meant to be read by the person who hit it.
 *
 * `describeError` exists because a raw Postgres or fetch error is never worth
 * showing — but some failures are raised by this app, about this app, with a
 * sentence already chosen for the screen. Those need a way to say so, or the
 * fallback swallows them.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export interface DescribedError {
  /** Written for the person who hit it. Always safe to show. */
  message: string;
  /** The underlying error, shown only in development mode. */
  detail?: string;
}

const asPostgrest = (error: unknown): PostgrestLike | null =>
  typeof error === 'object' && error !== null ? (error as PostgrestLike) : null;

/** The raw text, for development mode and for nothing else. */
export const rawErrorText = (error: unknown): string => {
  const p = asPostgrest(error);
  if (p) {
    const parts = [p.code && `[${p.code}]`, p.message, p.details, p.hint].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  if (error instanceof Error) return error.message;
  return String(error);
};

/**
 * Postgres error classes, in the words of the person who hit them.
 *
 * These are the ones the app can actually produce. A check constraint is the
 * interesting case: it means a control let through something the database
 * refuses, which is a gap in the form rather than a mistake by the user — but
 * they still need to be told plainly rather than shown the constraint name.
 */
const BY_CODE: Record<string, string> = {
  '23505': 'That already exists. Give it a different name.',
  '23503': 'That refers to something that has since been removed. Refresh and try again.',
  '23514': 'Some of those details aren’t allowed. Check the amounts and dates and try again.',
  '23502': 'Something required was missing. Fill in every field and try again.',
  '22003': 'That number is too large to record.',
  '22P02': 'Something wasn’t in the format expected. Check what you entered.',
  '42501': 'You don’t have permission to change that.',
  PGRST116: 'That no longer exists. It may have been deleted on another device.',
  PGRST204: 'This version of the app is out of date. Reload to pick up the latest.',
  PGRST301: 'Your session has expired. Sign in again.',
};

const BY_TEXT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'That email and password don’t match an account.'],
  [/email not confirmed/i, 'Check your inbox and confirm your email address first.'],
  [/(user already registered|already been registered)/i,
    'An account with that email already exists. Try signing in instead.'],
  [/password should be at least/i, 'Passwords need to be at least 8 characters.'],
  [/(rate limit|too many)/i, 'Too many attempts. Wait a minute and try again.'],
  [/(failed to fetch|network|networkerror)/i,
    'Couldn’t reach the server. Check your connection and try again.'],
  [/(jwt|token).*(expired|invalid)/i, 'Your session has expired. Sign in again.'],
  [/new row violates row-level security/i, 'You don’t have permission to change that.'],
];

/**
 * @param error    whatever was thrown or returned
 * @param fallback what to say when nothing more specific is known
 */
export const describeError = (error: unknown, fallback = 'Something went wrong.'): DescribedError => {
  const detail = rawErrorText(error);
  const dev = isDevMode();

  // Already written for the person who will read it, so it is shown as it is.
  // Everything below exists to stop a raw error reaching a screen; an error
  // raised deliberately with a sentence in it has already done that work, and
  // running it through the fallback would replace the one useful thing it has
  // to say with "Something went wrong."
  if (error instanceof UserFacingError) return { message: error.message, detail: dev ? detail : undefined };

  const p = asPostgrest(error);
  const byCode = p?.code ? BY_CODE[p.code] : undefined;
  if (byCode) return { message: byCode, detail: dev ? detail : undefined };

  const text = p?.message ?? (error instanceof Error ? error.message : String(error ?? ''));
  for (const [pattern, message] of BY_TEXT) {
    if (pattern.test(text)) return { message, detail: dev ? detail : undefined };
  }

  // Nothing matched. This is the case that used to leak: the old helper
  // returned the raw message when it recognised nothing, which is precisely
  // when the raw message is least likely to mean anything to anybody.
  return { message: fallback, detail: dev ? detail : undefined };
};

/** Friendly text only — for the many callers that just need a string. */
export const errorMessage = (error: unknown, fallback?: string): string =>
  describeError(error, fallback).message;
