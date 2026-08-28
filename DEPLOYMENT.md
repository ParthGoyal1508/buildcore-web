# Frontend Deployment Checklist — buildcore-web

Stack: Next.js 16 (App Router) + React 19 + Tailwind.
Goal: free tier wherever possible.

## 1. Pick a hosting platform

- [ ] **Vercel (Hobby/free tier)** — recommended. Built by the Next.js team, zero-config for the App Router, free SSL, unlimited deploys, generous free bandwidth.
  - ⚠️ **Check this before committing**: Vercel's Hobby tier is licensed for **personal, non-commercial use** per their Terms of Service. If BuildCore is a commercial product, you'd technically need the Pro plan (~$20/mo). Flagging explicitly since it's easy to miss and matters for "free wherever possible."
- [ ] Netlify (free tier) — solid Next.js support, viable alternative if Vercel's commercial-use restriction is a blocker.
- [ ] Cloudflare Pages — needs the `@cloudflare/next-on-pages` adapter; more setup risk given how new Next.js 16 is (feature-support lag).

> Decision: ______________

## 2. Project setup

- [ ] Import the GitHub repo into the chosen platform; confirm it auto-detects Next.js and uses `next build` / `next start`.
- [ ] `dev` and `start` scripts pin port `3001` (`-p 3001`) — most platforms set their own port via `$PORT`/proxy, so this shouldn't matter, but double check the deployed app isn't hardcoded to `3001` anywhere else.

## 3. Environment variables

- [ ] Set `NEXT_PUBLIC_API_URL` in the platform's env var UI, pointing at the deployed **backend** URL (see `.env.local.example` — currently defaults to `http://localhost:3000`).
- [ ] Set separate values per environment: Preview deployments → staging/dev API URL, Production → prod API URL.
- [ ] Anything server-only (secrets) must **not** be prefixed `NEXT_PUBLIC_` — that prefix bundles the value into client JS. (Nothing server-only exists yet per `app/lib/api/client.ts`, but keep this in mind as auth/session logic grows.)

## 4. Domains

- [ ] Add a custom domain in the platform; confirm auto SSL provisioning.
- [ ] Decide `www` vs apex redirect behavior.

## 5. CI/CD

- [ ] Confirm auto-deploy on push to `main` (production) and preview deployments per PR are enabled — both are default on Vercel/Netlify.
- [ ] Add `next lint` (and `tsc --noEmit` if not already covered) as a required GitHub check before merge.

## 6. Backend connectivity (coordinate with buildcore-api checklist)

- [ ] Confirm `NEXT_PUBLIC_API_URL` points to the deployed backend, not `localhost`.
- [ ] Confirm the backend's CORS allowlist includes this frontend's deployed domain(s) — production domain **and** preview URLs (e.g. `*.vercel.app`) if you want preview deploys to hit the real API.
- [ ] If/when auth uses cookies, verify `SameSite`/`Secure` settings work across the frontend/backend domains (they're on different origins unless you put both behind one custom domain).

## 7. Observability

- [ ] Optional: Vercel Analytics / Speed Insights (free tier available).
- [ ] Optional: Sentry free tier for frontend error tracking.

## 8. Post-deploy verification

- [ ] Load the deployed site and run through the key user flows against the deployed backend (not a local API).
- [ ] Check Core Web Vitals / Lighthouse in the platform dashboard.
- [ ] Confirm the login flow works end-to-end (frontend → deployed API → deployed DB).

## 9. Free-tier limits to watch

- [ ] Vercel Hobby: bandwidth and build-minute caps — check usage as traffic grows.
- [ ] Re-confirm the commercial-use ToS point above once BuildCore has real users.
