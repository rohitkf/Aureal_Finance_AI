import { BASE_URL, ROUTES, createReporter, launch, setTheme } from './lib.mjs';

/**
 * Checks the WCAG 2.2 AA criteria that are cheap to verify automatically:
 * accessible names, labelled fields, heading order, target size, contrast,
 * focus visibility and dialog focus management.
 */
const report = createReporter('Accessibility');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

// ---- Names, labels, heading order, target size -------------------------
let structural = true;
for (const route of ROUTES) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const issues = await page.evaluate((pathname) => {
    const out = [];
    const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();

    for (const el of document.querySelectorAll('button, a[href]')) {
      if (getComputedStyle(el).display === 'none') continue;
      if (!name(el)) out.push(`control with no accessible name: ${el.outerHTML.slice(0, 70)}`);
      // WCAG 2.2 SC 2.5.8 Target Size (Minimum) is 24x24 CSS pixels, with an
      // exemption for links sitting inline inside a sentence, and for the
      // skip link, which is only 1x1 until it receives focus.
      const r = el.getBoundingClientRect();
      const inlineInSentence =
        el.tagName === 'A' &&
        getComputedStyle(el).display === 'inline' &&
        (el.parentElement?.textContent ?? '').trim() !== name(el);
      const isSkipLink = el.classList.contains('sr-only');
      if (r.width > 0 && !inlineInSentence && !isSkipLink && (r.height < 24 || r.width < 24)) {
        out.push(`target below 24px (${Math.round(r.width)}x${Math.round(r.height)}): "${name(el).slice(0, 30)}"`);
      }
    }

    for (const el of document.querySelectorAll('input, select, textarea')) {
      const labelled =
        (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
        el.getAttribute('aria-label') ||
        el.closest('label');
      if (!labelled) out.push(`field with no label: ${el.outerHTML.slice(0, 70)}`);
    }

    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) out.push(`image with no alt text: ${img.src}`);
    }

    const levels = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]));
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1) out.push(`heading level jumps h${levels[i - 1]} → h${levels[i]}`);
    }
    const h1s = document.querySelectorAll('h1').length;
    if (h1s !== 1 && pathname !== '/login') out.push(`${h1s} <h1> elements (expected exactly one)`);

    return [...new Set(out)];
  }, route);

  for (const issue of issues.slice(0, 5)) {
    report.note(`${route} — ${issue}`);
    structural = false;
  }
}
report.check(structural, 'names, labels, heading order and target sizes');

// ---- Colour contrast, in both themes -----------------------------------
const contrastRoutes = ['/', '/accounts', '/transactions', '/budget', '/forecast', '/reports', '/settings'];
for (const theme of ['dark', 'light']) {
  await setTheme(page, theme);
  let ok = true;
  for (const route of contrastRoutes) {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const failures = await page.evaluate(() => {
      const channel = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const contrast = (a, b) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const backgroundBehind = (el) => {
        for (let node = el; node; node = node.parentElement) {
          const s = getComputedStyle(node);
          const alpha = Number((s.backgroundColor.match(/[\d.]+\)$/) || ['1)'])[0].replace(')', ''));
          const rgb = parse(s.backgroundColor);
          if (rgb.length === 3 && alpha > 0.85) return rgb;
        }
        return [255, 255, 255];
      };

      const out = [];
      for (const el of document.querySelectorAll('p, span, h1, h2, h3, a, button, td, th, dt, dd, label, li')) {
        const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
        if (!ownText) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || el.closest('.sr-only')) continue;
        const size = parseFloat(s.fontSize);
        const weight = Number(s.fontWeight) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const required = large ? 3 : 4.5;
        const ratio = contrast(parse(s.color), backgroundBehind(el));
        if (ratio < required) out.push(`${ratio.toFixed(2)}:1 (needs ${required}) — "${ownText.slice(0, 32)}"`);
      }
      return [...new Set(out)];
    });
    for (const f of failures.slice(0, 4)) {
      report.note(`${theme} ${route} — ${f}`);
      ok = false;
    }
  }
  report.check(ok, `${theme} mode meets AA contrast`);
}

// ---- Keyboard operation -------------------------------------------------
await setTheme(page, 'dark');
await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.keyboard.press('Tab');
report.check(
  (await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to main content',
  'skip link is the first stop in the tab order',
);

let visibleFocus = 0;
for (let i = 0; i < 25; i += 1) {
  await page.keyboard.press('Tab');
  const visible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return s.outlineStyle !== 'none' || s.boxShadow !== 'none';
  });
  if (visible) visibleFocus += 1;
}
report.check(visibleFocus >= 24, `focus is visible on every stop (${visibleFocus}/25)`);

await page.getByRole('button', { name: 'New entry' }).click();
await page.waitForTimeout(400);
for (let i = 0; i < 40; i += 1) await page.keyboard.press('Tab');
report.check(
  await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))),
  'focus is trapped inside an open dialog',
);
await page.keyboard.press('Escape');
await page.waitForTimeout(350);
report.check(
  await page.evaluate(() => Boolean(document.activeElement?.textContent?.includes('New entry'))),
  'focus returns to the trigger when a dialog closes',
);

await browser.close();
report.finish();
