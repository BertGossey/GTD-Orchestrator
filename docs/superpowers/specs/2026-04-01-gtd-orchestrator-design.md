# GTD Orchestrator — Design Spec

## Overview

A web application implementing the Getting Things Done (GTD) methodology, modeled after the Nirvana GTD app. Users capture tasks via rapid entry, have them enriched by an LLM, and organize them across GTD workflow sections with drag-and-drop.

**Tech stack**: Next.js 16 (App Router, Server Components, Server Actions), TypeScript, Tailwind CSS v4, shadcn/ui, Prisma v7, Supabase PostgreSQL, Azure OpenAI (gpt-5).

**Auth**: Skipped for v1. No login required.

---

## Data Model

### Enums

```
TaskSection: INBOX | NEXT | WAITING | SCHEDULED | SOMEDAY | LOGBOOK
ProjectStatus: ACTIVE | INACTIVE
```

### Project

| Field       | Type          | Notes                          |
|-------------|---------------|--------------------------------|
| id          | UUID          | Primary key, default generated |
| title       | String        | Required                       |
| description | String?       | Optional                       |
| status      | ProjectStatus | Default: ACTIVE                |
| createdAt   | DateTime      | Auto                           |
| updatedAt   | DateTime      | Auto                           |
| tasks       | Task[]        | Relation                       |

### Task

| Field         | Type         | Notes                                      |
|---------------|--------------|---------------------------------------------|
| id            | UUID         | Primary key, default generated              |
| rawInput      | String       | Original sentence typed by user             |
| title         | String       | LLM-generated or fallback to rawInput       |
| description   | String?      | LLM-generated                               |
| section       | TaskSection  | Default: INBOX                              |
| sortOrder     | Int          | Position within section list                |
| dueDate       | DateTime?    | LLM-extracted or manually set               |
| scheduledDate | DateTime?    | Set when moved to SCHEDULED                 |
| waitingFor    | String?      | Free text — who/what is blocking            |
| completedAt   | DateTime?    | Set when moved to LOGBOOK                   |
| projectId     | UUID?        | FK to Project                               |
| createdAt     | DateTime     | Auto                                        |
| updatedAt     | DateTime     | Auto                                        |

**Index**: `(section, sortOrder)` for efficient list queries.

---

## UI Layout

Three-zone layout:

### Left Sidebar (~250px fixed)

Sections with nav links:

- **COLLECT**: Inbox (with count badge)
- **ACTIONS**: Next, Waiting, Scheduled, Someday
- **PROJECTS**: List of active projects + "Add project" button
- **CLEANUP**: Logbook

Active item is visually highlighted. Sidebar items are drop targets for cross-section drag-and-drop.

Uses shadcn `Sidebar` component.

### Top Bar (spans main content)

- Rapid Entry input: placeholder "type here and hit enter / or esc"
- On Enter: blocking call to Server Action → Azure OpenAI → creates task in INBOX
- Spinner shown during LLM processing

### Main Content Area

- Section title heading
- Ordered list of task rows, each showing:
  - Drag handle (grip dots)
  - Checkbox (complete → Logbook)
  - Task title
  - Right side: project badge (if assigned), due date badge (if set)
- Clicking a task expands it **inline** showing editable fields: title, description, due date, scheduled date, waiting for, project dropdown

---

## Task Movement & Drag-and-Drop

**Library**: `@dnd-kit/core` + `@dnd-kit/sortable`

### Within-list reordering

- Drag task up/down within its section
- Optimistic UI: reorder visually on drop, revert on server error
- Server Action updates `sortOrder` for affected tasks

### Cross-section movement

- Drag task to sidebar nav item → sidebar item highlights as drop target
- **To Scheduled** (no `scheduledDate`): show date picker dialog before completing move
- **To Waiting**: move immediately; user can fill "waiting for" via inline expand
- **All other moves**: immediate section change, appended to end of target list

### Checkbox completion

- Check → task moves to Logbook with `completedAt = now()`
- Brief fade-out animation before removal

### Scheduled date popup

- shadcn `Dialog` + `Calendar` component
- Triggered only when moving to Scheduled without existing scheduledDate
- User picks date, confirms → move completes

---

## LLM Task Enrichment

### Flow

1. User types sentence in Rapid Entry, presses Enter
2. Spinner shown in input area (blocking)
3. Server Action calls Azure OpenAI
4. Prompt extracts: `{ title, description, dueDate }` as structured JSON
5. Task created in DB: section=INBOX, enriched fields populated
6. UI refreshes via `revalidatePath`

### Azure OpenAI Configuration

- Package: `openai` npm (with Azure config)
- Env vars:
  - `AZURE_OPENAI_ENDPOINT` — Azure endpoint URL
  - `AZURE_OPENAI_API_KEY` — API key
  - `AZURE_OPENAI_DEPLOYMENT` — deployment name (gpt-5)
- JSON mode for structured output
- 10-second timeout
- **Fallback**: if LLM call fails, save task with `rawInput` as title, no description/date

### AI Client Setup

`src/lib/ai.ts` — configures and exports the Azure OpenAI client.

---

## Projects

- Sidebar lists active projects with "Add project" button
- Add project: dialog with title + optional description
- Click project in sidebar → filtered view of all tasks assigned to that project, grouped by section
- Task → project assignment via inline expand detail view (dropdown/combobox)
- Projects can be marked inactive (hidden from sidebar, tasks preserved)

### Project Detail View

- Project title + description at top (editable inline)
- Tasks grouped by current section
- Same task rows — checkbox, drag, inline expand all work normally

---

## Logbook

- Read-only list of completed tasks
- Ordered by `completedAt` descending
- Shows: task title, completion date, original section info, project badge
- No drag-and-drop, no reordering

---

## Component Architecture

```
src/
├── actions/
│   ├── tasks.ts              # createTask, updateTask, moveTask, reorderTasks, completeTask
│   └── projects.ts           # createProject, updateProject
├── app/
│   ├── page.tsx              # Redirect to /inbox
│   ├── (gtd)/
│   │   ├── layout.tsx        # Sidebar + top bar + main content shell
│   │   ├── inbox/page.tsx
│   │   ├── next/page.tsx
│   │   ├── waiting/page.tsx
│   │   ├── scheduled/page.tsx
│   │   ├── someday/page.tsx
│   │   ├── logbook/page.tsx
│   │   └── projects/
│   │       └── [id]/page.tsx # Project filtered view
├── components/
│   ├── gtd/
│   │   ├── sidebar.tsx
│   │   ├── rapid-entry.tsx        # Client component
│   │   ├── task-list.tsx          # Client component (dnd-kit)
│   │   ├── task-row.tsx
│   │   ├── task-detail.tsx        # Inline expand (client)
│   │   ├── scheduled-date-dialog.tsx
│   │   └── project-form.tsx
│   └── ui/                        # shadcn primitives
├── lib/
│   ├── ai.ts                      # Azure OpenAI client
│   ├── auth.ts                    # (existing)
│   ├── db.ts                      # (existing)
│   └── utils.ts                   # (existing)
├── hooks/
│   └── use-task-dnd.ts
└── types/
    └── gtd.ts                     # TaskSection enum, shared types
```

### shadcn components to add

`dialog`, `calendar`, `popover`, `input`, `badge`, `checkbox`, `sidebar`, `separator`, `dropdown-menu`, `command`

### Route Group

`(gtd)` groups all GTD pages under a shared layout (sidebar + top bar) without affecting URL paths. URLs are `/inbox`, `/next`, `/scheduled`, etc.

---

## Key Decisions

- **No auth for v1** — single-user, no login
- **Server Actions for all mutations** — idiomatic Next.js, no separate API layer
- **@dnd-kit for drag-and-drop** — well-maintained, React-native, works with Server Components pattern
- **Inline expand for task detail** — no side panel or modal, keeps context
- **Blocking LLM enrichment** — simpler than async; spinner during processing
- **Fallback on LLM failure** — task still created with raw input as title
