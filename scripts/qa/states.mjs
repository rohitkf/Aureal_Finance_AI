import { BASE_URL, createReporter, hasCredentials, launch, signIn } from './lib.mjs';

/**
 * Empty states, the 404 screen, and the PWA: the app has to stay useful when
 * there is no data and no network.
 */
const report = createReporter('Empty states & PWA');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

if (!hasCredentials) {
  report.skip('QA_EMAIL / QA_PASSWORD not set — these checks need a real account');
  await browser.close();
  report.finish();
  process.exit(0);
}

if (!(await signIn(page))) {
  report.skip('could not reach Supabase to sign in');
  await browser.close();
  report.finish();
  process.exit(0);
}

await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: 'Clear everything' }).click();
await page.waitForTimeout(300);
await page.locator('[role="dialog"]').getByRole('button', { name: 'Clear everything' }).click();
await page.waitForTimeout(500);

const EMPTY = [
  ['/', /set up your financial picture/i],
  ['/transactions', /No transactions yet/i],
  ['/budget', /No budgets set for this month/i],
  ['/recurring', /No recurring payments yet|Nothing active/i],
  ['/subscriptions', /No subscriptions yet|Nothing active/i],
  ['/goals', /No goals yet/i],
  ['/reports', /No data to report on yet/i],
  ['/forecast', /Nothing scheduled yet/i],
];

for (const [route, expected] of EMPTY) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  report.check(expected.test(await page.locator('main').innerText()), `${route} has an empty state`);
}

await page.goto(`${BASE_URL}/does-not-exist`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
report.check(/couldn’t find that page/i.test(await page.locator('main').innerText()), 'unknown routes show a 404 screen');

await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
await page.getByRole('button', { name: /Load sample data/ }).click();
await page.waitForTimeout(4000);
report.check(/£/.test(await page.locator('aside').innerText()), 'sample data can be loaded on request');

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
report.check(
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length > 0),
  'the service worker registers',
);

await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const offline = await page.locator('body').innerText();
report.check(/Good (morning|afternoon|evening)|Total balance/i.test(offline), 'the app loads with no network');
report.check(/You’re offline/i.test(offline), 'the offline banner appears');
await ctx.setOffline(false);

await browser.close();
report.finish();
