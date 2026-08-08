# SARING web

Secure, server-first scaffold for the SARING procurement evidence workspace.

Requires Node.js 22 or newer (`nvm use` reads the included `.nvmrc`).

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- Supabase Auth, PostgreSQL, and private Storage
- Prisma ORM with PostgreSQL driver adapter

## Start locally

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run dev
```

For a UI-only local preview, set `DEMO_BYPASS_AUTH=true`. The bypass is ignored when `NODE_ENV=production`.

## Database setup

1. Create a Supabase project, disable public signup, and keep the evidence bucket private.
2. Put the transaction-pooler URL in `DATABASE_URL` and session-pooler URL in `DIRECT_URL`.
3. Run `npm run db:setup` to deploy migrations, RLS, runtime-role grants, and Storage policies.
4. Invite an Auth user and run `npm run db:bootstrap -- user@example.go.id`.

Application transactions immediately assume the `saring_app` role, which is `NOLOGIN` and `NOBYPASSRLS`.

## Checks

```bash
npm run check
npm run build
```

## Demo data boundary

Workspace preview records live in `src/lib/fixtures/workspace.ts` and are passed from server pages into interactive components as serializable props. When backend queries are ready, replace those page-level fixture imports; the presentation components do not need to change.

Architecture and the honest security readiness checklist live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/SECURITY.md`](docs/SECURITY.md).

## Product and domain context

Read [`docs/SARING_MASTER_CONTEXT.md`](docs/SARING_MASTER_CONTEXT.md) before implementing product flow, canonical data, analytics, or AI integration. The preserved concept paper and detailed SARING knowledge package are indexed in [`docs/saring-knowledge/README.md`](docs/saring-knowledge/README.md).
