# AI Coach Server (Node.js)

A Node.js Express backend demonstrating:
- Supabase RLS policy (SQL)
- RevenueCat entitlement gating
- CI with Doppler secret injection + secret scanning (Gitleaks/TruffleHog)
- Sentry crash reporting
- Push notifications via Firebase Cloud Messaging
- AI Coach SSE (hello-stream) + moderation block logging (IDs only)
- CSV micro-actions + linter ensuring 65 stable IDs

## Quick start

1. Install dependencies

```bash
npm ci
```

2. Set environment (locally via Doppler or .env)
- SENTRY_DSN
- REVENUECAT_SECRET_API_KEY
- FIREBASE_SERVICE_ACCOUNT_B64 (Base64-encoded JSON for service account)
- PORT (optional, default 3000)

3. Run in dev

```bash
npm run dev
```

4. Test SSE

```bash
curl -N http://localhost:3000/ai/hello-stream
```

5. Test moderation block (now requires user JWT)

```bash
USER_JWT="<paste supabase access token>"
curl -s -X POST http://localhost:3000/ai/coach \
  -H "authorization: Bearer $USER_JWT" \
  -H 'content-type: application/json' \
  -d '{"prompt":"forbidden content","userId":"usr_123","sessionId":"sess_123","promptId":"pr_123"}' | jq .
```

6. Run micro-actions linter

```bash
npm run lint:micro-actions
```

## CI
GitHub Actions workflow in `.github/workflows/ci.yml` injects secrets from Doppler and runs secret scanners.

- Doppler injection: `doppler run -- npm run build` and `doppler run -- npm test` with `DOPPLER_TOKEN` from repo secrets
- Secret scanners: `gitleaks/gitleaks-action@v2` and `trufflesecurity/trufflehog@v3` run on every PR/commit to `main`

### CI & Secrets: Setup and Test

1) Add Doppler token in GitHub:
- In your Doppler project, create a Service Token with access to the config you want CI to use.
- In your GitHub repo, go to Settings → Secrets and variables → Actions → New repository secret.
- Name: `DOPPLER_TOKEN`, Value: paste the Doppler service token.

2) Trigger the workflow:
- Open a Pull Request or push a commit to `main`.

3) Verify in Actions logs:
- Steps should appear in order:
  - Install Doppler
  - Build with secrets (doppler run -- npm run build)
  - Test with secrets (doppler run -- npm test)
  - Gitleaks scan (no leaks should be reported)
  - TruffleHog scan (no verified secrets should be reported)

4) Optional: Add a status badge to this README

```
![CI](https://github.com/<your-org-or-user>/ai-coach-server/actions/workflows/ci.yml/badge.svg)
```

Replace `<your-org-or-user>` with your GitHub username or org.

## Supabase RLS

Example RLS policy (attach to a table like `user_profiles` with a `user_id` UUID column):

```sql
-- Enable RLS on the table
alter table public.user_profiles enable row level security;

-- Only row owner can select
create policy "user_can_select_own_profile"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

-- Only row owner can insert rows for themselves
create policy "user_can_insert_own_profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

-- Only row owner can update their rows
create policy "user_can_update_own_profile"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Only row owner can delete
create policy "user_can_delete_own_profile"
  on public.user_profiles
  for delete
  using (auth.uid() = user_id);
```

Deny test (401/403) with user token:

```bash
# 401 without a user token
curl -i http://localhost:3000/users

# 200 with a valid Supabase user access token
USER_JWT="<paste supabase access token>"
curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:3000/users

# 403 forbidden on admin route without admin key
curl -i -H "Authorization: Bearer $USER_JWT" http://localhost:3000/users/all

# 200 on admin route with X-Admin-Key
curl -i -H "Authorization: Bearer $USER_JWT" -H "x-admin-key: $ADMIN_API_KEY" http://localhost:3000/users/all
```

## RevenueCat gating

Dashboard setup:
- Create Products (per store), map them to an Offering
- Create an Entitlement (e.g., `premium`) and map products to it

Entitlement check via this server:

```js
// GET /users/entitlements/:key? (defaults to "premium")
const resp = await fetch("/users/entitlements/premium", {
  headers: { Authorization: `Bearer ${userJwt}` },
});
if (!resp.ok) throw new Error("entitlement check failed");
const { active } = await resp.json();
if (active) enablePremiumFeatures();
else showPaywallFor("premium");
```

Ensure your client SDK uses the Supabase `user.id` as the RevenueCat `appUserId`.

Caching:
- Server caches entitlement checks for `REV_CAT_CACHE_TTL_MS` (default 60000 ms) to reduce RevenueCat API calls.

## Crash & push

- Crashlytics/Sentry dashboard: set `SENTRY_DSN` and observe issues in your Sentry project.
- FCM server settings are redacted via `FIREBASE_SERVICE_ACCOUNT_B64` (Base64 of the service account JSON), loaded only on the server in `src/push/fcm.js`.

## AI Coach SSE

- Hello stream: `GET /ai/hello-stream` streams two JSON chunks and ends.
- Blocked prompt: `POST /ai/coach` (requires user JWT) returns 400 on blocked prompts and logs IDs only (no raw prompt).
- Moderation provider: uses OpenAI Moderations if `OPENAI_API_KEY` is set; otherwise falls back to a simple policy check.

Redacted log sample (IDs only):

```json
{
  "request": "moderation_block",
  "userId": "usr_123",
  "sessionId": "sess_123",
  "promptId": "pr_123"
}
```

Offerings endpoint (for client paywall):

```bash
USER_JWT="<paste supabase access token>"
curl -s -H "authorization: Bearer $USER_JWT" \
  http://localhost:3000/ai/offerings | jq .
```

## CSV & micro-actions

Canonical CSV order (sample row):

```csv
id,title,description,category,duration_secs
act_0001,Drink Water,Have a glass of water now,wellness,30
```

Lint expectations:
- Exactly 65 actions
- IDs must match `act_\d{4}` with no duplicates
- IDs must match `data/micro_actions_baseline.json` order exactly (stable IDs)

Run linter:

```bash
npm run lint:micro-actions
```

If you change the CSV, update `data/micro_actions_baseline.json` to reflect the ID order for stability.
