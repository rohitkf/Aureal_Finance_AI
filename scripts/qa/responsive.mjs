import { BASE_URL, ROUTES, createReporter, launch } from './lib.mjs';

/**
 * Every screen must fit its viewport at each supported width. Horizontal
 * scrolling on a phone is always a layout bug, never a design choice.
 */
const WIDTHS = [375, 390, 768, 1024, 1440, 1920];

const report = createReporter('Responsive layout');
const browser = await launch();

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.note(`${width}px — runtime error: ${e.message}`));

  let clean = true;
  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(650);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) {
      report.note(`${width}px — ${route} scrolls ${overflow}px horizontally`);
      clean = false;
    }
  }
  report.check(clean, `${width}px: all ${ROUTES.length} screens fit`);
  await ctx.close();
}

await browser.close();
report.finish();
