import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const BASE_URL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4173';

/** Reachable without signing in. */
export const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password'];

/** Behind the sign-in wall. */
export const APP_ROUTES = [
  '/',
  '/accounts',
  '/transactions',
  '/budget',
  '/forecast',
  '/recurring',
  '/subscriptions',
  '/goals',
  '/debts',
  '/reports',
  '/settings',
];

/**
 * Credentials for the suites that need to be inside the app. Set QA_EMAIL and
 * QA_PASSWORD to an account on the project under test; without them, those
 * suites skip rather than fail.
 */
export const CREDENTIALS = {
  email: process.env.QA_EMAIL ?? '',
  password: process.env.QA_PASSWORD ?? '',
};

export const hasCredentials = Boolean(CREDENTIALS.email && CREDENTIALS.password);

export const launch = () => {
  const preinstalled = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
  return chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
};

/**
 * Signs in and waits for the dashboard. Returns false if the app never got
 * past the sign-in screen — usually no network to Supabase.
 */
export const signIn = async (page) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByLabel('Email').fill(CREDENTIALS.email);
  await page.getByLabel('Password').fill(CREDENTIALS.password);
  await page.getByRole('button', { name: /Sign in/ }).click();
  try {
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
    await page.waitForTimeout(2500); // let the first data load settle
    return true;
  } catch {
    return false;
  }
};

/** Overrides the stored theme the same way the in-app toggle does. */
export const setTheme = async (page, theme) => {
  await page.evaluate((value) => {
    try {
      document.documentElement.classList.toggle('dark', value === 'dark');
    } catch {
      /* no-op */
    }
  }, theme);
};

export const createReporter = (title) => {
  const failures = [];
  console.log(`\n── ${title} ──`);
  return {
    check(ok, label) {
      console.log(`${ok ? '  ✓' : '  ✗'} ${label}`);
      if (!ok) failures.push(label);
    },
    note(message) {
      failures.push(message);
      console.log(`  ✗ ${message}`);
    },
    skip(reason) {
      console.log(`  — skipped: ${reason}`);
    },
    finish() {
      if (failures.length) {
        console.error(`\n${failures.length} failure(s) in ${title}`);
        process.exitCode = 1;
      } else {
        console.log('  all checks passed');
      }
      return failures.length === 0;
    },
  };
};
