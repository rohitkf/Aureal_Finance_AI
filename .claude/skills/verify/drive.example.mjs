import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const S = process.env.S, BASE = 'http://localhost:4412'
const now = new Date().toISOString()
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'v@example.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: now }
const acct = (id, name, type, balance) => ({ id, user_id: 'u1', name, type, institution: 'Monzo', balance, masked_number: '', sync_status: 'manual', last_synced_at: null,
  credit_limit: null, apr: null, statement_day: null, payment_due_day: null, minimum_payment: null, aer: null, note: null, group_id: null, archived: false, excluded: false, sort_order: 0, created_at: now, updated_at: now })
const T = {
  profiles: [{ id: 'u1', display_name: 'Rohit', currency: 'GBP', locale: 'en-GB', minimum_balance: 250, mask_balances: false, theme: 'dark', row_accents: null, due_horizon_days: 2, created_at: now, updated_at: now }],
  categories: [
    { id: 'c1', user_id: 'u1', name: 'Groceries', kind: 'expense', icon: 'shopping-basket', accent: 'warning', sort_order: 0, archived: false, created_at: now },
    { id: 'c3', user_id: 'u1', name: 'Eating out', kind: 'expense', icon: 'coffee', accent: 'secondary', sort_order: 1, archived: false, created_at: now },
    { id: 'c2', user_id: 'u1', name: 'Salary', kind: 'income', icon: 'wallet', accent: 'success', sort_order: 2, archived: false, created_at: now },
  ],
  accounts: [acct('a1', 'Everyday', 'current', 2400), acct('a2', 'Rainy Day', 'savings', 900)],
  goals: [{ id: 'g1', user_id: 'u1', name: 'Holiday', target: 1000, saved: 876.55, target_date: '2027-06-01', monthly_contribution: 50, icon: 'plane', linked_account_id: null, created_at: now, updated_at: now }],
}
let profileDelay = 0
const writes = []
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
async function newPage(width = 1100, height = 1000) {
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(([u]) => localStorage.setItem('sb-supabase-auth-token', JSON.stringify({ access_token: 'x.eyJzdWIiOiJ1MSIsImV4cCI6OTk5OTk5OTk5OX0.x', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: u })), [user])
  await ctx.route('http://supabase.test/**', async (route) => {
    const req = route.request(), url = new URL(req.url())
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user })
    if (url.pathname.includes('/realtime/')) return route.abort()
    const t = url.pathname.replace('/rest/v1/', '')
    if (req.method() !== 'GET') { writes.push(`${req.method()} ${t} ${req.postData() ?? ''}`); return route.fulfill({ status: 201, json: [] }) }
    if (t === 'profiles' && profileDelay) await new Promise((r) => setTimeout(r, profileDelay))
    const rows = T[t] ?? []
    if ((req.headers()['accept'] || '').includes('pgrst.object')) return rows.length ? route.fulfill({ json: rows[0] }) : route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'none' } })
    return route.fulfill({ json: rows })
  })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  return p
}
const log = (...a) => console.log(...a)
const take = (re) => { const out = writes.filter((w) => re.test(w)); writes.length = 0; return out.map((w) => w.slice(0, 420)) }
const p = await newPage()

// 1. Transaction amount: calculator with a malformed number, then a valid sum
await p.goto(BASE + '/transactions'); await p.waitForTimeout(2200)
await p.getByRole('button', { name: /Add transaction/ }).first().click(); await p.waitForTimeout(600)
const amt = p.getByLabel('Amount', { exact: true })
await amt.pressSequentially('12.50.10+5')
log('1a typed "12.50.10+5" → field:', JSON.stringify(await amt.inputValue()), '| result line:', JSON.stringify(await p.getByText(/^= /).first().textContent().catch(() => '(none)')))
log('1b Save disabled:', await p.getByRole('button', { name: /save transaction/i }).isDisabled(), '| any alert:', await p.getByRole('alert').count(), '| text near amount:', JSON.stringify((await p.getByRole('dialog').innerText()).split('\n').slice(0, 8).join(' / ')))
await p.getByRole('dialog').screenshot({ path: `${S}/v-tx-malformed.png` })
await amt.fill(''); await amt.pressSequentially('12.40+3')
log('1c typed "12.40+3" → result line:', JSON.stringify(await p.getByText(/^= /).first().textContent().catch(() => '(none)')))
// split parts
await amt.fill(''); await amt.pressSequentially('40')
await p.getByRole('button', { name: /Split this payment/ }).click(); await p.waitForTimeout(300)
const part2 = p.getByLabel('Part 2 amount')
await part2.pressSequentially('1.2.3abc4')
log('1d split part 2 typed "1.2.3abc4" →', JSON.stringify(await part2.inputValue()))
await p.screenshot({ path: `${S}/v-tx-split.png` })
await p.keyboard.press('Escape'); await p.waitForTimeout(400)

// 2. Savings account: AER optional rate
await p.goto(BASE + '/accounts'); await p.waitForTimeout(2000)
await p.getByRole('button', { name: /Add account/ }).first().click(); await p.waitForTimeout(500)
await p.getByRole('combobox', { name: 'Type' }).click(); await p.getByRole('option', { name: /^Savings/ }).click()
const aer = p.getByRole('slider', { name: 'Interest rate (AER %)' })
log('2a AER initial:', await aer.getAttribute('aria-valuetext'))
await p.getByRole('button', { name: 'More — Interest rate (AER %)' }).click()
await aer.focus(); for (let i = 0; i < 93; i++) await p.keyboard.press('ArrowRight')
log('2b AER after + then 93× ArrowRight:', await aer.getAttribute('aria-valuetext'))
await p.getByLabel('Account name').fill('Saver'); await p.getByLabel(/Balance today/).pressSequentially('100')
await p.getByRole('dialog').getByRole('button', { name: /Add account/ }).click(); await p.waitForTimeout(700)
log('2c saved:', take(/accounts/).map((w) => (w.match(/"aer":[^,]+/) || ['?'])[0]).join(' '))

// 3. Virtual account target
await p.getByRole('button', { name: 'Add an allocation' }).click(); await p.waitForTimeout(500)
const tgt = p.getByLabel('Target', { exact: true })
await tgt.pressSequentially('1..2.00')
log('3a allocation target typed "1..2.00" →', JSON.stringify(await tgt.inputValue()))
await p.getByRole('dialog').screenshot({ path: `${S}/v-allocation.png` })
await p.keyboard.press('Escape'); await p.waitForTimeout(300)

// 4. Goals: new goal + contribution dial ending at what is still needed
await p.goto(BASE + '/goals'); await p.waitForTimeout(2000)
await p.getByRole('button', { name: /Add money/ }).first().click(); await p.waitForTimeout(400)
const cs = p.getByRole('slider', { name: 'Amount slider' })
await cs.focus(); await p.keyboard.press('End')
log('4a contribution slider End →', await p.getByLabel('Amount', { exact: true }).inputValue(), '(still needed £123.45)')
await p.getByRole('button', { name: /Add contribution/ }).click(); await p.waitForTimeout(500)
log('4b saved:', take(/goal/).join(' | ') || '(no write)')
await p.getByRole('button', { name: /New goal/ }).first().click(); await p.waitForTimeout(400)
await p.getByLabel('Name').first().fill('Car')
await p.getByLabel('Target amount', { exact: true }).pressSequentially('8,000.555')
log('4c target typed "8,000.555" →', await p.getByLabel('Target amount', { exact: true }).inputValue())
await p.getByRole('button', { name: /^Save goal$/ }).click(); await p.waitForTimeout(600)
log('4d saved:', take(/goals/).map((w) => (w.match(/"target":[^,]+/) || [w])[0]).join(' '))

// 5. Recurring: quarterly every 2, ends after count — saved body
await p.goto(BASE + '/recurring'); await p.waitForTimeout(2000)
await p.getByRole('button', { name: /Add recurring payment/ }).first().click(); await p.waitForTimeout(500)
await p.getByLabel('Amount', { exact: true }).pressSequentially('45')
await p.getByLabel('Name').fill('Water')
await p.getByRole('combobox', { name: 'Category' }).click(); await p.getByRole('option', { name: /Groceries/ }).click()
await p.getByRole('combobox', { name: 'Frequency' }).click(); await p.getByRole('option', { name: 'Quarterly' }).click()
await p.getByRole('button', { name: 'More — Repeat every' }).click()
log('5a readout:', await p.getByRole('slider', { name: 'Repeat every' }).getAttribute('aria-valuetext'))
await p.getByRole('combobox', { name: 'Ends' }).click(); await p.getByRole('option', { name: /After a number/ }).click()
const n = p.getByRole('slider', { name: 'Number of payments' }); await n.focus(); await p.keyboard.press('Home')
log('5b count after Home:', await n.getAttribute('aria-valuetext'), '| Less disabled:', await p.getByRole('button', { name: 'Less — Number of payments' }).isDisabled())
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight')
await p.getByRole('button', { name: /Create payment/ }).click(); await p.waitForTimeout(700)
log('5c saved:', take(/recurring/).map((w) => [/"frequency":"[^"]+"/, /"interval":\d+/, /"occurrences":\d+/, /"amount":[^,]+/].map((r) => (w.match(r) || ['?'])[0]).join(' ')).join(' | '))

// 6. Budget save
await p.goto(BASE + '/budget'); await p.waitForTimeout(2000)
await p.getByRole('button', { name: 'Add a budget' }).click(); await p.waitForTimeout(400)
const bs = p.getByRole('slider', { name: 'Monthly limit slider' }); await bs.focus(); await p.keyboard.press('End')
log('6a budget End →', await p.getByLabel('Monthly limit', { exact: true }).inputValue())
await p.getByLabel('Monthly limit', { exact: true }).fill(''); await p.getByLabel('Monthly limit', { exact: true }).pressSequentially('2600')
log('6b typed past the track (2600) → slider:', await bs.getAttribute('aria-valuetext'), '| label:', (await p.getByRole('dialog').locator('div.tnum').last().innerText()).replace(/\n/g, ' '))
await p.getByRole('dialog').getByRole('button', { name: /Save|Add budget|Set budget/ }).last().click(); await p.waitForTimeout(500)
log('6c saved:', take(/budget/).map((w) => (w.match(/"limit_amount":[^,}]+/) || [w])[0]).join(' '))
await p.context().close()

// 7. Settings opened directly while the profile is slow to arrive
profileDelay = 1800
const q = await newPage()
await q.goto(BASE + '/settings'); await q.waitForTimeout(600)
const mbField = () => q.getByLabel('Minimum balance', { exact: true })
log('7a at 0.6s, field:', await mbField().inputValue().catch(() => '(not rendered yet)'))
await q.waitForTimeout(2500)
log('7b after profile arrives, field:', await mbField().inputValue())
await q.getByRole('button', { name: 'More — Minimum balance' }).click(); await q.getByRole('heading').first().click(); await q.waitForTimeout(500)
log('7c saved:', take(/profiles/).join(' | '))
// probe: paste garbage, then leave → error or nothing saved?
await mbField().fill(''); await mbField().focus(); await q.keyboard.insertText('abc'); await q.getByRole('heading').first().click(); await q.waitForTimeout(400)
log('7d pasted "abc" then left → field:', JSON.stringify(await mbField().inputValue()), '| error:', JSON.stringify(await q.getByRole('alert').first().textContent().catch(() => '(none)')), '| writes:', take(/profiles/).length)
await q.locator('main').screenshot({ path: `${S}/v-settings.png` }).catch(() => {})
await b.close()
