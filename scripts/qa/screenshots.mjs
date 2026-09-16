import { mkdir } from 'node:fs/promises';
import { BASE_URL, ROUTES, launch, setTheme } from './lib.mjs';

/** Captures every screen in both themes at desktop and phone widths. */
const outDir = process.env.QA_SHOTS ?? 'screenshots';
await mkdir(outDir, { recursive: true });

const browser = await launch();

for (const theme of ['dark', 'light']) {
  for (const { width, label, mobile } of [
    { width: 1440, label: 'desktop', mobile: false },
    { width: 390, label: 'mobile', mobile: true },
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: mobile ? 2 : 1,
    });
    const page = await ctx.newPage();
    await setTheme(page, theme);
    for (const route of ROUTES) {
      const name = route === '/' ? 'dashboard' : route.replace(/^\//, '').replace(/\//g, '-');
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${outDir}/${theme}-${label}-${name}.png`, fullPage: true });
    }
    await ctx.close();
    console.log(`captured ${theme} ${label}`);
  }
}

await browser.close();
console.log(`screenshots written to ${outDir}/`);
