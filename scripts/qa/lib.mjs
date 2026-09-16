import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const BASE_URL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4173';

export const ROUTES = [
  '/',
  '/accounts',
  '/accounts/acc-aqua',
  '/transactions',
  '/budget',
  '/forecast',
  '/recurring',
  '/subscriptions',
  '/goals',
  '/debts',
  '/reports',
  '/settings',
  '/login',
];

/**
 * Launches Chromium, preferring a pre-installed binary when one is present
 * (CI images often ship one) and otherwise falling back to Playwright's own.
 */
export const launch = () => {
  const preinstalled = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
  return chromium.launch(existsSync(preinstalled) ? { executablePath: preinstalled } : {});
};

/** Overrides the stored theme the same way the in-app toggle does. */
export const setTheme = async (page, theme) => {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.evaluate((value) => {
    const raw = window.localStorage.getItem('aureal.state.v1');
    if (!raw) return;
    const state = JSON.parse(raw);
    state.settings.theme = value;
    window.localStorage.setItem('aureal.state.v1', JSON.stringify(state));
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
    finish() {
      if (failures.length) {
        console.error(`\n${failures.length} failure(s) in ${title}`);
        process.exitCode = 1;
      } else {
        console.log(`  all checks passed`);
      }
      return failures.length === 0;
    },
  };
};
