# Setting this up from a fork

Standing up your own instance: a Supabase project, email that actually
sends, the app running locally or in a container, and a deployment.

Nothing here is shared with the original project. Your fork gets its own
database, its own users and its own keys.

Roughly 20 minutes, most of it waiting for Supabase to provision.

---

## Before you start

You need:

- **Node 22+** and npm
- A **Supabase** account — the free tier is enough
- A **Resend** account (or any SMTP provider) for transactional email
- A domain you can add DNS records to, if you want email to reach anybody
  other than yourself
- Optionally **Docker**, if you would rather not install Node

---

## 1. Get the code

```bash
git clone https://github.com/<you>/Aureal_Finance_AI.git
cd Aureal_Finance_AI
npm install
```

---

## 2. Create a Supabase project

1. [database.new](https://database.new) → name it, pick a region near you,
   and save the database password somewhere. You will not be shown it again.
2. Wait for provisioning to finish.
3. **Project Settings → Data API** — copy the **Project URL**.
4. **Project Settings → API Keys** — copy the **publishable** key
   (`sb_publishable_…`).

> The publishable key is meant to be public. It is compiled into the browser
> bundle and grants only what row-level security allows. The **secret** key
> (`sb_secret_…`) bypasses every policy — it must never appear in this
> repository, in a `VITE_*` variable, or in anything a browser can load.

---

## 3. Apply the migrations

Four files in `supabase/migrations/`, applied **in filename order**. Either
route works.

**SQL Editor** — open each file, paste, run, in order:

```
20260917055955_init_core_schema.sql
20260917060041_init_row_level_security.sql
20260917060112_init_triggers_and_provisioning.sql
20260917060134_restrict_security_definer_functions.sql
```

**Or the CLI:**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then check it landed. **Advisors → Security** should be empty. If it reports
a table without row-level security, a migration did not apply — do not carry
on until it is clean.

What you just created: ten tables, all owned by a user and isolated by
row-level security; a trigger that maintains account balances from the
ledger; and a trigger that gives each new sign-up a profile and sixteen
starter categories.

---

## 4. Point the app at it

```bash
cp .env.example .env
```

Fill in the two values from step 2:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx
```

```bash
npm run dev          # http://localhost:5173
```

`.env` is git-ignored. Keep it that way.

---

## 5. Email — the step that is easy to skip

Supabase's built-in sender **only delivers to members of your project** and
allows a couple of emails an hour. It will look like email works, because it
works for you. Everybody else's sign-up will silently never arrive.

So before anybody else uses this, configure SMTP.

### Verify a sending domain

In [Resend](https://resend.com) → **Domains** → **Add Domain**. A subdomain
such as `auth.yourdomain.com` keeps transactional mail apart from anything
else you send. Add the DKIM, SPF and DMARC records Resend shows you to your
DNS, and wait for **verified**.

### Create a sending key

**API Keys** → **Create API Key**. Give it **Sending access** only, and
restrict it to the domain you just verified. Copy the token — it is shown
once.

### Point Supabase at it

**Project Settings → Authentication → SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender email | `no-reply@auth.yourdomain.com` |
| Sender name | Aureal Finance AI |

### Then raise the rate limit

**Authentication → Rate Limits**. Enabling SMTP does **not** lift Supabase's
own cap on auth emails. Leave it and sign-ups start failing the moment more
than a handful of people arrive at once.

### And set the redirect URLs

**Authentication → URL Configuration**:

- **Site URL** — where the app is deployed
- **Redirect URLs** — add `https://your-app.example.com/**`, plus
  `http://localhost:5173/**` for local development

The app sends people to `/login` after confirming their address and
`/reset-password` after a password reset. Both must be allowed here, and
both must resolve — see §8.

---

## 6. Make your first account

Open `/signup`, use a real address, confirm the email.

Signing up creates a profile and sixteen categories. It creates **no
accounts, no transactions and no budgets** — the app starts genuinely empty
and everything on screen from then on is either something you entered or
something derived from it.

Add an account first (**Accounts → Add account**); its opening balance is
recorded as a transaction, because the database derives balances from the
ledger rather than storing them.

---

## 7. Running it in Docker instead

```bash
cp .env.example .env     # fill in as in step 4
docker compose up --build
```

→ http://localhost:8080

The values are **build arguments**, not runtime environment: Vite compiles
them into the bundle. After changing `.env`, run `docker compose build`
again — `up` alone will not pick them up.

---

## 8. Deploying

Any static host works. The build output is `dist/`.

**On Vercel:** import the repository, framework preset **Vite**, and set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in **Settings →
Environment Variables**. Vercel bakes them in at build time, so **changing a
variable does nothing until you redeploy**.

`vercel.json` is required, not optional. The app uses `BrowserRouter`, and
Vercel's Vite preset adds no SPA fallback — without the rewrite, every route
except `/` returns 404, including the two the auth emails point at. The
container gets the same rule from `nginx.conf`.

Then go back to step 5 and put the deployed URL into Supabase's **Site URL**
and **Redirect URLs**.

---

## 9. When something is wrong

| What you see | What it is |
|---|---|
| A configuration error screen instead of the app | `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` missing from the build. On Vercel: set them, then **redeploy**. |
| 404 on `/login` or any route but `/` | The SPA rewrite is missing. `vercel.json` on Vercel, `nginx.conf` in Docker. |
| Sign-up works, no email arrives | Custom SMTP is not configured, or the auth rate limit is exhausted. §5. |
| The confirmation link 404s | Same as above — plus check **Redirect URLs**. |
| *"Could not find the table … in the schema cache"* | A migration has not been applied. §3, then `notify pgrst, 'reload schema';`. |
| Balances look wrong | Do not correct them by hand. They are derived from `transactions` by a trigger; the missing or wrong row is the bug. |
| Somebody can see another person's data | Stop. A row-level security policy did not apply. Check **Advisors → Security**. |
