# GTD Orchestrator

A web application implementing the Getting Things Done (GTD) methodology for personal task and project organization. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Rapid Entry** — type a sentence, press Enter, and an LLM enriches it into a structured task (title, description, due date)
- **GTD Sections** — Inbox, Next, Waiting, Scheduled, Someday, Logbook
- **Drag-and-Drop** — reorder tasks within a list or drag to sidebar sections to move them
- **Inline Task Editing** — expand any task to edit title, description, dates, waiting-for, and project assignment
- **Projects** — group tasks by project, view filtered by project
- **Scheduled Date Picker** — prompted automatically when moving a task to Scheduled without a date

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (base-nova style)
- **Database**: Supabase (PostgreSQL) with Prisma ORM v7
- **Drag-and-Drop**: @dnd-kit
- **AI**: Azure OpenAI (task enrichment)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Set a **database password** (save it — you'll need it for the connection strings)
3. Wait for the project to finish provisioning

### 3. Get Connection Strings

1. In your Supabase project dashboard, go to **Settings > Database**
2. Scroll to **Connection string** and copy from the **URI** tab:
   - **Transaction pooler** (port 6543) — use as `DATABASE_URL`
   - **Session pooler** or **Direct connection** (port 5432) — use as `DIRECT_URL`
3. Replace `[YOUR-PASSWORD]` in each string with your database password

### 4. Configure Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
# Supabase PostgreSQL
DATABASE_URL="postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres"

# NextAuth.js
NEXTAUTH_SECRET="<generate with command below>"
NEXTAUTH_URL="http://localhost:3000"

# Azure OpenAI (optional — app works without it, tasks just won't be AI-enriched)
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_DEPLOYMENT="gpt-5"
```

Generate the NextAuth secret:

```bash
openssl rand -base64 32
```

### 5. Push Schema to Database

```bash
npx prisma db push
```

This creates all tables (User, Account, Session, VerificationToken, Task, Project) and enums in your Supabase database.

### 6. Verify Database (Optional)

```bash
npx prisma studio
```

Opens a browser GUI at `localhost:5555` where you can inspect all tables.

### 7. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the Inbox.

## Scripts

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm test             # Run unit tests (vitest)
npm run test:watch   # Run tests in watch mode
```

## Project Structure

```
src/
  actions/          # Server Actions (tasks, projects)
  app/(gtd)/        # GTD pages (inbox, next, waiting, scheduled, someday, logbook, projects)
  components/gtd/   # GTD components (sidebar, task-list, task-row, rapid-entry, etc.)
  components/ui/    # shadcn/ui primitives
  lib/              # Utilities (db, ai client, auth)
  types/            # Shared TypeScript types
```
