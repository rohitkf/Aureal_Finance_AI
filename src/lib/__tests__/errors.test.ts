import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, errorMessage, rawErrorText } from '../errors';
import { setDevMode } from '../devMode';

afterEach(() => setDevMode(false));

const pgError = (code: string, message = 'boom', details?: string, hint?: string) => ({
  code,
  message,
  details: details ?? null,
  hint: hint ?? null,
});

describe('describeError, with development mode off', () => {
  it('never returns the underlying error', () => {
    const cases: unknown[] = [
      pgError('23505', 'duplicate key value violates unique constraint "categories_user_name_kind_key"'),
      pgError('42501', 'new row violates row-level security policy for table "accounts"'),
      new Error('TypeError: Cannot read properties of undefined (reading \'id\')'),
      'some string nobody wrote for a person',
      { weird: true },
      null,
      undefined,
    ];
    for (const c of cases) {
      const described = describeError(c);
      expect(described.detail).toBeUndefined();
      expect(described.message).not.toContain('constraint');
      expect(described.message).not.toContain('row-level security policy');
      expect(described.message).not.toContain('undefined');
    }
  });

  it('falls back to plain english for an error it does not recognise', () => {
    // The old helper returned the raw message here — exactly when the raw
    // message is least likely to mean anything to anybody.
    expect(describeError(new Error('pq: deadlock detected')).message).toBe('Something went wrong.');
    expect(describeError(new Error('pq: deadlock detected'), 'Please try again.').message).toBe(
      'Please try again.',
    );
  });

  it('explains the Postgres failures this app can actually produce', () => {
    expect(describeError(pgError('23505')).message).toMatch(/already exists/i);
    expect(describeError(pgError('23503')).message).toMatch(/has since been removed/i);
    expect(describeError(pgError('23514')).message).toMatch(/aren’t allowed/i);
    expect(describeError(pgError('23502')).message).toMatch(/required was missing/i);
    expect(describeError(pgError('22003')).message).toMatch(/too large/i);
    expect(describeError(pgError('42501')).message).toMatch(/permission/i);
    expect(describeError(pgError('PGRST204')).message).toMatch(/out of date/i);
    expect(describeError(pgError('PGRST301')).message).toMatch(/session has expired/i);
  });

  it('keeps the auth messages people actually hit', () => {
    expect(describeError(new Error('Invalid login credentials')).message).toMatch(/don’t match an account/i);
    expect(describeError(new Error('Email not confirmed')).message).toMatch(/confirm your email/i);
    expect(describeError(new Error('User already registered')).message).toMatch(/already exists/i);
    expect(describeError(new Error('Failed to fetch')).message).toMatch(/couldn’t reach the server/i);
    expect(describeError(new Error('For security purposes, rate limit exceeded')).message).toMatch(
      /too many attempts/i,
    );
  });

  it('prefers the code over the text when both would match', () => {
    // A check violation whose message happens to mention the network.
    const described = describeError(pgError('23514', 'network check failed'));
    expect(described.message).toMatch(/aren’t allowed/i);
  });
});

describe('describeError, with development mode on', () => {
  it('hands back the underlying error alongside the friendly one', () => {
    setDevMode(true);
    const described = describeError(
      pgError('23505', 'duplicate key value', 'Key (name)=(Groceries) already exists.', 'try another'),
    );
    expect(described.message).toMatch(/already exists/i);
    expect(described.detail).toContain('[23505]');
    expect(described.detail).toContain('duplicate key value');
    expect(described.detail).toContain('Key (name)=(Groceries)');
    expect(described.detail).toContain('try another');
  });

  it('includes detail even when nothing was recognised', () => {
    setDevMode(true);
    const described = describeError(new Error('pq: deadlock detected'));
    expect(described.message).toBe('Something went wrong.');
    expect(described.detail).toBe('pq: deadlock detected');
  });

  it('stops including it again the moment it is turned off', () => {
    setDevMode(true);
    expect(describeError(new Error('boom')).detail).toBe('boom');
    setDevMode(false);
    expect(describeError(new Error('boom')).detail).toBeUndefined();
  });
});

describe('rawErrorText', () => {
  it('joins what a PostgREST error carries', () => {
    expect(rawErrorText(pgError('23514', 'violates check', 'on table x', 'fix it'))).toBe(
      '[23514] · violates check · on table x · fix it',
    );
  });

  it('copes with an Error, a string and nothing at all', () => {
    expect(rawErrorText(new Error('plain'))).toBe('plain');
    expect(rawErrorText('just text')).toBe('just text');
    expect(rawErrorText(null)).toBe('null');
    expect(rawErrorText(undefined)).toBe('undefined');
  });
});

describe('errorMessage', () => {
  it('is the friendly text and nothing else, even in development mode', () => {
    setDevMode(true);
    expect(errorMessage(new Error('pq: deadlock detected'), 'Could not load your data.')).toBe(
      'Could not load your data.',
    );
  });
});

describe('a localStorage that throws', () => {
  it('is treated as development mode being off, not as a crash', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.');
    });
    try {
      expect(() => describeError(new Error('boom'))).not.toThrow();
      expect(describeError(new Error('boom')).detail).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});
