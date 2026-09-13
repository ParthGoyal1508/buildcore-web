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

- [ ] Set **`API_ORIGIN`** to the deployed backend URL (e.g. `https://buildcore-api.onrender.com`). No
      `NEXT_PUBLIC_` prefix — the browser never talks to the API directly; it calls this app's own
      origin at `/bff` and `next.config.ts` rewrites server-side.

  > **This is read at BUILD time, not run time.** Next resolves `rewrites()` during the build and
  > writes the destination into `.next/routes-manifest.json`. Set it only as a runtime variable and
  > the proxy stays pointed at `localhost`, which presents as *"login works, nothing else does"*.
  > Changing it later needs a **rebuild**, not a restart. `next.config.ts` throws on a production
  > build without it, so this cannot ship silently.

- [ ] Set separate values per environment: Preview → staging API, Production → prod API.
- [ ] **`NEXT_PUBLIC_API_URL` is gone.** Delete it from the platform if present. It no longer does
      anything, and repointing it is a tempting non-fix for a broken deployment.
- [ ] Anything server-only must **not** be prefixed `NEXT_PUBLIC_` — that prefix bundles the value
      into client JS.

## 4. Domains

- [ ] Add a custom domain in the platform; confirm auto SSL provisioning.
- [ ] Decide `www` vs apex redirect behavior.

## 5. CI/CD

- [ ] Confirm auto-deploy on push to `main` (production) and preview deployments per PR are enabled — both are default on Vercel/Netlify.
- [ ] Add `next lint` (and `tsc --noEmit` if not already covered) as a required GitHub check before merge.

## 6. Backend connectivity (coordinate with buildcore-api)

The frontend and API are no longer separate origins *as far as the browser is concerned*. Every
API call goes to this app's origin under `/bff` and is proxied server-side, which is what makes the
session cookie first-party. Two settings have to agree across the repos, and when they disagree
**nothing errors** — users are just silently signed out on their first page refresh.

- [ ] **On the API: `REFRESH_COOKIE_PATH=/bff/auth`.** Its default is `/auth`, which is not a prefix
      of `/bff/auth`, so the browser stores the refresh cookie and never sends it back. This is the
      single highest-risk setting in either deployment; it has already caused this exact outage once
      in local development.
- [ ] **On the API: leave `REFRESH_COOKIE_SECURE` unset.** It exists only so Safari can be tested
      over `http://localhost`. The API refuses to start if it is disabled with
      `NODE_ENV=production`.
- [ ] CORS is no longer load-bearing for the browser — the proxy hop is server-to-server and not
      subject to it. Keep `CORS_ORIGINS` set anyway unless you have confirmed nothing else calls the
      API directly.

### Deploy order — expect a one-time sign-out

There is **no ordering that avoids signing everyone out**, because the cookie's path has to change
on both sides at once:

| Order | What breaks |
|---|---|
| API first | The still-deployed old frontend calls the API cross-origin, and the new API's `SameSite` default is `lax` rather than the old inferred `none` — so the cookie stops being sent on those cross-site requests. |
| Frontend first | The new frontend renews at `/bff/auth/refresh-token` while the old API is still issuing the cookie at `/auth`. |

So: set both env vars, deploy both, and accept that live sessions end once. The blast radius is
small — production records showed only 15 of 89 sign-ins ever renewed successfully — and those
users get a working 90-day session afterwards, most for the first time.

Do **not** try to bridge it with `REFRESH_COOKIE_PATH=/`. It does cover both paths, but afterwards
the browser holds two `refreshToken` cookies with different paths and sends both, and which one the
server reads is not something worth depending on.

## 7. Observability

- [ ] Optional: Vercel Analytics / Speed Insights (free tier available).
- [ ] Optional: Sentry free tier for frontend error tracking.

## 8. Post-deploy verification

- [ ] Load the deployed site and run through the key user flows against the deployed backend (not a local API).
- [ ] Check Core Web Vitals / Lighthouse in the platform dashboard.
- [ ] Confirm the login flow works end-to-end (frontend → deployed API → deployed DB).
- [ ] **Sign in, then open DevTools → Application → Cookies and check `refreshToken` shows
      `Path=/bff/auth`.** Thirty seconds, and it is the one check that catches the misconfiguration
      above before your users do.
- [ ] Reload the page. Staying signed in is the whole point of the change; being returned to
      `/login` means the cookie path is wrong.
- [ ] Repeat both in **Safari**, which refuses third-party cookies by default and is where this
      class of defect is most visible.

## 9. Free-tier limits to watch

- [ ] Vercel Hobby: bandwidth and build-minute caps — check usage as traffic grows.
- [ ] Re-confirm the commercial-use ToS point above once BuildCore has real users.
