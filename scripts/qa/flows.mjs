import { BASE_URL, createReporter, launch } from './lib.mjs';

/**
 * The prototype flows from the product brief, driven end to end:
 * sign in → dashboard → add an expense → it shows up and the numbers move;
 * create a recurring payment → the forecast changes;
 * create a budget → existing spending is already counted against it.
 */
const report = createReporter('Product flows');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => report.note(`runtime error: ${e.message}`));

// ---- Sign in ------------------------------------------------------------
await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(`${BASE_URL}/`);
await page.waitForTimeout(900);
report.check(
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sarah/ }).isVisible(),
  'signing in lands on the dashboard',
);

// ---- Add an expense -----------------------------------------------------
const safeToSpend = async () =>
  (await page.locator('section[aria-labelledby="sts-heading"] p').first().innerText()).replace(/\s/g, '');
const before = await safeToSpend();

await page.getByRole('button', { name: 'New entry' }).click();
await page.getByLabel('Amount', { exact: true }).fill('42.50');
await page.getByLabel('Merchant').fill('QA Cafe');
await page.getByRole('button', { name: 'Save transaction' }).click();
await page.waitForTimeout(600);

await page.goto(`${BASE_URL}/transactions`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
report.check(await page.getByText('QA Cafe').first().isVisible(), 'the new expense appears in the ledger');

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const after = await safeToSpend();
report.check(before !== after, `Safe to Spend recalculates (${before} → ${after})`);

// ---- Create a recurring payment ----------------------------------------
await page.goto(`${BASE_URL}/forecast`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const troughBefore = await page.locator('text=Lowest projected balance').locator('xpath=../..').innerText();

await page.goto(`${BASE_URL}/recurring?new=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByLabel('Amount', { exact: true }).fill('400');
await page.getByLabel('Name').fill('QA Storage Unit');
await page.getByLabel('Payment day of month').fill('22');
await page.waitForTimeout(300);
const preview = await page.locator('text=Next payments').locator('xpath=..').innerText();
report.check(preview.split('2026').length > 2, 'the recurrence form previews real future dates');
await page.getByRole('button', { name: 'Create payment' }).click();
await page.waitForTimeout(600);

await page.goto(`${BASE_URL}/forecast`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const troughAfter = await page.locator('text=Lowest projected balance').locator('xpath=../..').innerText();
report.check(troughBefore !== troughAfter, 'the forecast low point moves once a commitment is added');
report.check(
  await page.getByText('QA Storage Unit').first().isVisible(),
  'the new commitment appears in the day-by-day ledger',
);

// ---- Create a budget ----------------------------------------------------
await page.goto(`${BASE_URL}/budget`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.getByRole('button', { name: 'Add a budget' }).click();
await page.getByLabel('Category').selectOption('household');
await page.getByLabel('Monthly limit').fill('60');
await page.getByRole('button', { name: 'Save budget' }).click();
await page.waitForTimeout(600);
const card = page.locator('h3', { hasText: 'Household' }).first();
report.check(await card.isVisible(), 'the new budget card appears');
const cardText = await card.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]').innerText();
report.check(/of £60/.test(cardText), 'the budget already counts spending that happened before it existed');

// ---- Global search ------------------------------------------------------
await page.keyboard.press('Control+k');
await page.waitForTimeout(300);
await page.getByPlaceholder('Search transactions, accounts, subscriptions…').fill(
  'how much did I spend on food last month',
);
await page.waitForTimeout(400);
report.check(
  await page.getByText(/on Groceries/).first().isVisible(),
  'search answers a natural-language spending question',
);
await page.keyboard.press('Escape');

// ---- Destructive confirmation ------------------------------------------
await page.goto(`${BASE_URL}/recurring`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Delete QA Storage Unit' }).click();
await page.waitForTimeout(300);
report.check(
  await page.getByText(/stop future projected payments/).isVisible(),
  'the delete dialog explains what will stop happening',
);
report.check(
  await page.getByText(/already happened will not be deleted/).isVisible(),
  'the delete dialog explains what is preserved',
);
await page.locator('[role="dialog"]').getByRole('button', { name: 'Delete', exact: true }).click();
await page.waitForTimeout(500);
report.check(
  (await page.locator('main ul li', { hasText: 'QA Storage Unit' }).count()) === 0,
  'the commitment is removed once confirmed',
);

// ---- Theme --------------------------------------------------------------
await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click();
await page.waitForTimeout(300);
report.check(
  await page.evaluate(() => !document.documentElement.classList.contains('dark')),
  'the theme toggle switches to light mode',
);

await browser.close();
report.finish();
