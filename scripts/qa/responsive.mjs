import {
  APP_ROUTES,
  BASE_URL,
  PUBLIC_ROUTES,
  createReporter,
  hasCredentials,
  launch,
  signIn,
} from './lib.mjs';

/**
 * Every screen must fit its viewport at each supported width. Horizontal
 * scrolling on a phone is always a layout bug, never a design choice.
 */
const WIDTHS = [375, 390, 768, 1024, 1440, 1920];

const report = createReporter('Responsive layout');
const browser = await launch();

// The app screens need a signed-in session; the auth screens never do.
let routes = PUBLIC_ROUTES;
if (hasCredentials) {
  const probe = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const probePage = await probe.newPage();
  if (await signIn(probePage)) routes = [...PUBLIC_ROUTES, ...APP_ROUTES];
  else report.skip('could not sign in — checking the public screens only');
  await probe.close();
} else {
  report.skip('QA_EMAIL / QA_PASSWORD not set — checking the public screens only');
}

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.note(`${width}px — runtime error: ${e.message}`));
  if (routes.length > PUBLIC_ROUTES.length) await signIn(page);

  let clean = true;
  for (const route of routes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) {
      report.note(`${width}px — ${route} scrolls ${overflow}px horizontally`);
      clean = false;
    }
  }
  report.check(clean, `${width}px: all ${routes.length} screens fit`);
  await ctx.close();
}

await browser.close();
report.finish();
