---
name: verify
description: Run the real built Aureal app in Chromium against a stubbed Supabase, to observe a change at its UI surface when there are no credentials and *.supabase.co is unreachable.
---

# Verify Aureal at runtime

`npm run qa` needs `QA_EMAIL`/`QA_PASSWORD` and a reachable Supabase, which a
sandbox does not have. Instead: build against a fake host and answer every
request to it from Playwright. Real bundle, router, store and CSS; only the
backend is fixtures.

1. Build: `VITE_SUPABASE_URL=http://supabase.test VITE_SUPABASE_PUBLISHABLE_KEY=pk-test npx vite build --outDir <scratch>/aureal-dist --emptyOutDir`
   (the variable is `..._PUBLISHABLE_KEY`, not `..._ANON_KEY`).
2. Serve: `npx vite preview --outDir <scratch>/aureal-dist --port 4412 --strictPort &`
3. Drive with Playwright — `drive.example.mjs` beside this file is a full
   pass over the number controls; copy its `newPage()` for anything else:
   - `addInitScript` seeds `localStorage['sb-supabase-auth-token']` with a
     session whose `expires_at` is in the future (key from the host's first
     label: `supabase`).
   - `context.route('http://supabase.test/**')`: `/auth/v1/*` → the user;
     `/realtime/*` → abort; GET `/rest/v1/<table>` → fixture rows; a request
     with `Accept: …pgrst.object…` gets one row (the profile is read this
     way), or a 406 `PGRST116`. Log every non-GET body: that is what the app
     would have written.
   - The profile row must exist, or `StoreGate` shows the load-failed screen.
   - Pass `serviceWorkers: 'block'` to the context, or the PWA worker gets
     in the way of the routes.
4. Stop the server by PID (`ps -eo pid,args | grep "[v]ite preview --outDir"`);
   the `npx` wrapper's PID is not the server's.

Gotchas:
- `NODE_PATH` does not reach ESM. Import Playwright by absolute path,
  `/opt/node22/lib/node_modules/playwright/index.mjs`, with
  `executablePath: '/opt/pw-browsers/chromium'`.
- jsdom does not move a native `<input type="range">` with arrow keys;
  Chromium does. Keyboard behaviour of sliders is only observable here.
- To catch "rendered before the data arrived" bugs, delay the `profiles`
  response (the example's `profileDelay`) and open the page directly.
