# CLAUDE.md

**Read [AGENTS.md](./AGENTS.md) before making changes.** It holds all of it:
the branch rule, the commands that must pass, what the domain words mean,
where things live, the database rules, and the handful of things in this
repo that fail silently.

This file is deliberately a pointer and not a second copy. A second list of
house rules would drift out of step with the first, and then there would be
two answers and no way to tell which one was current.

## The three that apply every session

1. **Work on `develop`, and only `develop`.** Never create a branch. Never
   push to `main` — it is production and moves only by a pull request, which
   merges itself once CI is green.
2. **Before pushing**: `npm run verify` (lint, typecheck, 350 tests, build).
   All clean, every time.
3. **The app cannot reach Supabase from a sandbox** — outbound traffic to
   `*.supabase.co` is usually blocked, so the signed-in app cannot be
   exercised by eye. Check claims against real output — tests, the build,
   `dist/`, a live query through the Supabase tools — and say plainly what
   is still unverified.
