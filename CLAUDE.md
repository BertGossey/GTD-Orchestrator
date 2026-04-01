# CLAUDE.md

@AGENTS.md

## Project Overview

GTD Orchestrator — a **Next.js + TypeScript** web app implementing the Getting Things Done (GTD) methodology for personal task/project organization. 

## Tech Layers
- **Framework**: Next.js 15.3.3 with App Router
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: Tailwind CSS v4 with PostCSS
- **UI**: Radix UI + shadcn/ui components
- **Database**: Supabase(PostgreSQL) with Prisma ORM

## Important Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, next/core-web-vitals + typescript)
npm run start        # Serve production build
npm run typecheck    # TypeScript check

npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate dev --name <name>  # Create and apply a migration
npx prisma db push   # Push schema to DB without migration (prototyping)
npx prisma studio    # Open Prisma Studio GUI

npx shadcn@latest add <component>  # Add a shadcn/ui component
```

## Architecture

### Routing & Layouts
- **App Router** with `src/app/` directory. File-based routing via `page.tsx` files.
- `src/app/(auth)/` — route group for authentication pages (login, etc.). Does not affect URL paths.
- `src/app/api/` — API route handlers. NextAuth lives at `api/auth/[...nextauth]/route.ts`.

### Data Layer
- **Prisma v7** schema at `prisma/schema.prisma`. Generated client outputs to `src/generated/prisma/`.
- **Prisma config** at `prisma.config.ts` — datasource URL lives here (not in schema). Connection strings via `DATABASE_URL` env var.
- **Driver adapter**: Uses `@prisma/adapter-pg` (not a direct Prisma connection URL). The adapter is configured in `src/lib/db.ts`.
- **Database singleton** at `src/lib/db.ts` — always import `db` from here, never instantiate `PrismaClient` directly.
- Import PrismaClient from `@/generated/prisma/client` (not `@/generated/prisma` — Prisma v7 has no index file).
- Supabase PostgreSQL — `DATABASE_URL` for the connection, `DIRECT_URL` for migrations.

### Authentication
- **NextAuth.js v5** configured in `src/lib/auth.ts`. Exports `{ handlers, auth, signIn, signOut }`.
- Uses `PrismaAdapter` with JWT session strategy.
- Auth models (User, Account, Session, VerificationToken) are in the Prisma schema.

### UI & Styling
- **Tailwind CSS v4** — configured via CSS imports in `src/app/globals.css` (no `tailwind.config.ts`).
- **shadcn/ui** — component primitives live in `src/components/ui/`. Add new ones with `npx shadcn@latest add <name>`.
- Config in `components.json`. Uses `base-nova` style, `lucide` icons, CSS variables for theming.
- Use the `cn()` utility from `@/lib/utils` for conditional class merging.

### Directory Conventions
- `src/components/ui/` — shadcn/ui primitives (auto-generated, editable)
- `src/components/common/` — shared components used across 2+ features (Header, Footer, etc.)
- `src/components/{feature}/` — feature-scoped components (e.g., `src/components/inbox/`)
- `src/hooks/` — custom React hooks
- `src/types/` — shared TypeScript types/interfaces
- `src/actions/` — Next.js Server Actions (form mutations, data writes)
- `src/lib/` — utilities and third-party client setup

### Import Alias
`@/*` maps to `./src/*`. Always use `@/` imports (e.g., `import { db } from "@/lib/db"`).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values. Required:
- `DATABASE_URL` — Supabase pooled connection string
- `DIRECT_URL` — Supabase direct connection string
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — app URL (`http://localhost:3000` for dev)
