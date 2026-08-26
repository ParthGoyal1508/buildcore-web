# BuildCore Web

Frontend for BuildCore ERP — Next.js 16 (App Router) + Tailwind CSS, talking to [buildcore-api](../buildcore-api) over REST.

Scaffolded from the [Next.js Learn dashboard course starter](https://github.com/vercel/next-learn/tree/main/dashboard/starter-example), with the direct-Postgres demo plumbing (`app/query`, `app/seed`, `next-auth`, `bcrypt`, raw `postgres` queries) removed — this project's data access goes through `buildcore-api`, never straight to the database — and the Acme invoices/customers demo domain replaced with the actual BuildCore module list, per `docs/HLD.md` and `docs/prd/00-master-prd.md` in the [ERP-Demo](../ERP-Demo) repo.

## What's here

- `/login` — working login form (`react-hook-form` + `zod`) that calls `buildcore-api`'s `POST /auth/login` and stores the access token
- `/dashboard` — sidebar shell (`app/ui/dashboard/sidenav.tsx`, `nav-links.tsx`) with one entry per ERP module from the PRD, plus a KPI-cards pattern (`cards.tsx`) with placeholder data
- `app/lib/api/` — typed fetch wrapper (`client.ts`) and auth calls (`auth.ts`)
- Reusable UI pieces carried over from the course starter: `button.tsx`, `search.tsx`, `skeletons.tsx` (trimmed to the generic card/table skeletons)

## What's deliberately not here yet

1. **Real dashboard data** — `getDashboardSummary()` in `cards.tsx` returns hardcoded zeros; wire it to a real backend endpoint once one exists
2. **Token handling matching the HLD** — the access token currently lives in `localStorage` (see the note in `app/lib/api/auth.ts`); the documented design is an in-memory access token + an HTTP-only refresh-token cookie set by the API (`docs/HLD.md` §9.1), which needs the backend to set cookies on login first
3. **shadcn/ui** — not initialized in this pass; run `npx shadcn@latest init` when you start building real module screens
4. **`@tanstack/react-query` and `zustand`** — in the HLD's package list but not installed here since nothing uses them yet; add when the first real data-fetching screen needs them
5. **`@serwist/next`** (PWA/offline shell) and **`lucide-react`** — HLD-recommended, not wired yet
6. **Typed API client generation** (`openapi-typescript` against `buildcore-api`'s `/api-json`) — worth doing once the backend has more than two endpoints

## Getting started

```bash
npm install
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at buildcore-api
npm run dev
```

Runs on **`http://localhost:3001`** — `buildcore-api` runs on `:3000`, so both can run side by side locally without a port clash.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on :3001 (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Production server on :3001 |
| `npm run lint` | Next.js ESLint |
