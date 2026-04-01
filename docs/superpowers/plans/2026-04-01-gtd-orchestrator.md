# GTD Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GTD (Getting Things Done) web app with inbox capture, LLM-powered task enrichment, drag-and-drop task organization across sections (Inbox, Next, Waiting, Scheduled, Someday, Logbook), and project grouping.

**Architecture:** Server Components for data fetching, Server Actions for mutations, client components only for interactive parts (drag-and-drop, rapid entry, inline expand). Route group `(gtd)` wraps all pages in a shared sidebar+topbar layout.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui (base-nova), Prisma v7 + Supabase PostgreSQL, @dnd-kit for drag-and-drop, openai npm package for Azure OpenAI.

**Spec:** `docs/superpowers/specs/2026-04-01-gtd-orchestrator-design.md`

**Important:** Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/` — APIs may differ from your training data.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `src/types/gtd.ts` | Shared TypeScript types for Task, Project, TaskSection |
| `src/lib/ai.ts` | Azure OpenAI client setup and task enrichment function |
| `src/actions/tasks.ts` | Server Actions: createTask, updateTask, moveTask, reorderTasks, completeTask |
| `src/actions/projects.ts` | Server Actions: createProject, updateProject |
| `src/components/gtd/sidebar.tsx` | Left nav sidebar with section links, project list, drop targets |
| `src/components/gtd/rapid-entry.tsx` | Top bar input for quick task capture (client component) |
| `src/components/gtd/task-list.tsx` | Sortable task list with @dnd-kit (client component) |
| `src/components/gtd/task-row.tsx` | Single task row: drag handle, checkbox, title, badges, expand toggle |
| `src/components/gtd/task-detail.tsx` | Inline expandable detail view with editable fields (client component) |
| `src/components/gtd/scheduled-date-dialog.tsx` | Date picker dialog for scheduling tasks |
| `src/components/gtd/project-form.tsx` | Dialog for creating/editing projects |
| `src/app/(gtd)/layout.tsx` | GTD layout shell: sidebar + top bar + main content area |
| `src/app/(gtd)/inbox/page.tsx` | Inbox section page |
| `src/app/(gtd)/next/page.tsx` | Next actions section page |
| `src/app/(gtd)/waiting/page.tsx` | Waiting section page |
| `src/app/(gtd)/scheduled/page.tsx` | Scheduled section page |
| `src/app/(gtd)/someday/page.tsx` | Someday section page |
| `src/app/(gtd)/logbook/page.tsx` | Logbook section page |
| `src/app/(gtd)/projects/[id]/page.tsx` | Project detail filtered view |

### Files to modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Task, Project models + enums |
| `.env.example` | Add Azure OpenAI env vars |
| `src/app/page.tsx` | Redirect to `/inbox` |
| `package.json` | Add `typecheck` script |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @dnd-kit packages**

```bash
cd /Users/bert.gossey/work/workspaces/gtd_orchestrator
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Install openai package**

```bash
npm install openai
```

- [ ] **Step 3: Add typecheck script to package.json**

Add to the `"scripts"` section of `package.json`:

```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dnd-kit and openai dependencies"
```

---

## Task 2: Add shadcn UI Components

**Files:**
- Create: `src/components/ui/` (multiple component files)

- [ ] **Step 1: Add all required shadcn components**

```bash
cd /Users/bert.gossey/work/workspaces/gtd_orchestrator
npx shadcn@latest add sidebar input badge checkbox separator dialog calendar popover dropdown-menu command -y
```

Note: This may add transitive dependencies (e.g., `tooltip`, `sheet` for sidebar). Accept all defaults.

- [ ] **Step 2: Verify components were added**

```bash
ls src/components/ui/
```

Expected: `badge.tsx`, `button.tsx`, `calendar.tsx`, `checkbox.tsx`, `command.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `popover.tsx`, `separator.tsx`, `sidebar.tsx` (plus any transitive deps).

- [ ] **Step 3: Run typecheck to verify**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: add shadcn ui components for GTD app"
```

---

## Task 3: Prisma Schema — GTD Models

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add enums and models to Prisma schema**

Add the following to the end of `prisma/schema.prisma`:

```prisma
// GTD enums
enum TaskSection {
  INBOX
  NEXT
  WAITING
  SCHEDULED
  SOMEDAY
  LOGBOOK
}

enum ProjectStatus {
  ACTIVE
  INACTIVE
}

// GTD models
model Project {
  id          String        @id @default(uuid())
  title       String
  description String?
  status      ProjectStatus @default(ACTIVE)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  tasks       Task[]
}

model Task {
  id            String      @id @default(uuid())
  rawInput      String
  title         String
  description   String?
  section       TaskSection @default(INBOX)
  sortOrder     Int
  dueDate       DateTime?
  scheduledDate DateTime?
  waitingFor    String?
  completedAt   DateTime?
  projectId     String?
  project       Project?    @relation(fields: [projectId], references: [id])
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([section, sortOrder])
}
```

- [ ] **Step 2: Add Azure OpenAI env vars to .env.example**

Append to `.env.example`:

```
# Azure OpenAI
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_DEPLOYMENT="gpt-5"
```

- [ ] **Step 3: Push schema to database**

```bash
npx prisma db push
```

Expected: Schema synced, no errors.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: Client generated to `src/generated/prisma/`.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat: add Task and Project models to Prisma schema"
```

---

## Task 4: TypeScript Types

**Files:**
- Create: `src/types/gtd.ts`

- [ ] **Step 1: Create shared types file**

Create `src/types/gtd.ts`:

```typescript
import type { Task, Project, TaskSection } from "@/generated/prisma/client";

export type { Task, Project, TaskSection };

// Re-export the enrichment result type from ai.ts
export type { EnrichmentResult } from "@/lib/ai";

// Props for task list components
export type TaskWithProject = Task & {
  project: Project | null;
};
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/gtd.ts
git commit -m "feat: add shared GTD TypeScript types"
```

---

## Task 5: Azure OpenAI Client

**Files:**
- Create: `src/lib/ai.ts`

- [ ] **Step 1: Create AI client and enrichment function**

Create `src/lib/ai.ts`:

```typescript
import { AzureOpenAI } from "openai";

function getClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: "2024-12-01-preview",
  });
}

export type EnrichmentResult = {
  title: string;
  description: string | null;
  dueDate: string | null;
};

export async function enrichTask(
  rawInput: string
): Promise<EnrichmentResult> {
  const client = getClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5";

  const today = new Date().toISOString().split("T")[0];

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: "system",
        content: `You are a task assistant. Given a short sentence describing a task, extract:
- "title": a concise, action-oriented title (max 80 chars)
- "description": an expanded description if the sentence contains extra context, otherwise null
- "dueDate": an ISO date string (YYYY-MM-DD) if a deadline or date is mentioned, otherwise null. Today is ${today}.

Respond with valid JSON only. No markdown, no extra text.`,
      },
      {
        role: "user",
        content: rawInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { title: rawInput, description: null, dueDate: null };
  }

  const parsed = JSON.parse(content) as EnrichmentResult;
  return {
    title: parsed.title || rawInput,
    description: parsed.description || null,
    dueDate: parsed.dueDate || null,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: add Azure OpenAI client for task enrichment"
```

---

## Task 6: Server Actions — Tasks

**Files:**
- Create: `src/actions/tasks.ts`

- [ ] **Step 1: Create task server actions**

Create `src/actions/tasks.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrichTask } from "@/lib/ai";
import type { TaskSection } from "@/generated/prisma/client";

export async function createTask(rawInput: string) {
  // Get next sort order for INBOX
  const maxOrder = await db.task.aggregate({
    where: { section: "INBOX" },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  let title = rawInput;
  let description: string | null = null;
  let dueDate: Date | null = null;

  try {
    const enriched = await enrichTask(rawInput);
    title = enriched.title;
    description = enriched.description;
    dueDate = enriched.dueDate ? new Date(enriched.dueDate) : null;
  } catch {
    // Fallback: use rawInput as title
  }

  const task = await db.task.create({
    data: {
      rawInput,
      title,
      description,
      dueDate,
      section: "INBOX",
      sortOrder: nextOrder,
    },
  });

  revalidatePath("/inbox");
  return task;
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    dueDate?: Date | null;
    scheduledDate?: Date | null;
    waitingFor?: string | null;
    projectId?: string | null;
  }
) {
  const task = await db.task.update({
    where: { id },
    data,
  });

  revalidatePath("/", "layout");
  return task;
}

export async function moveTask(
  id: string,
  targetSection: TaskSection,
  scheduledDate?: Date
) {
  // Get next sort order in target section
  const maxOrder = await db.task.aggregate({
    where: { section: targetSection },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const updateData: Record<string, unknown> = {
    section: targetSection,
    sortOrder: nextOrder,
  };

  if (targetSection === "LOGBOOK") {
    updateData.completedAt = new Date();
  }

  if (targetSection === "SCHEDULED" && scheduledDate) {
    updateData.scheduledDate = scheduledDate;
  }

  const task = await db.task.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/", "layout");
  return task;
}

export async function reorderTasks(
  section: TaskSection,
  orderedIds: string[]
) {
  // Update sortOrder for each task in the new order
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.task.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/", "layout");
}

export async function completeTask(id: string) {
  return moveTask(id, "LOGBOOK");
}

export async function getTasksBySection(section: TaskSection) {
  return db.task.findMany({
    where: { section },
    orderBy: section === "SCHEDULED"
      ? { scheduledDate: "asc" }
      : { sortOrder: "asc" },
    include: { project: true },
  });
}

export async function getInboxCount() {
  return db.task.count({ where: { section: "INBOX" } });
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/tasks.ts
git commit -m "feat: add task server actions (create, update, move, reorder, complete)"
```

---

## Task 7: Server Actions — Projects

**Files:**
- Create: `src/actions/projects.ts`

- [ ] **Step 1: Create project server actions**

Create `src/actions/projects.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ProjectStatus } from "@/generated/prisma/client";

export async function createProject(title: string, description?: string) {
  const project = await db.project.create({
    data: { title, description },
  });

  revalidatePath("/", "layout");
  return project;
}

export async function updateProject(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: ProjectStatus;
  }
) {
  const project = await db.project.update({
    where: { id },
    data,
  });

  revalidatePath("/", "layout");
  return project;
}

export async function getActiveProjects() {
  return db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectWithTasks(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: { project: true },
      },
    },
  });
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/projects.ts
git commit -m "feat: add project server actions (create, update, list, detail)"
```

---

## Task 8: Home Page Redirect

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace home page with redirect to /inbox**

Replace the contents of `src/app/page.tsx` with:

```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/inbox");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redirect home page to /inbox"
```

---

## Task 9: GTD Layout Shell

**Files:**
- Create: `src/app/(gtd)/layout.tsx`
- Create: `src/components/gtd/sidebar.tsx`
- Create: `src/components/gtd/rapid-entry.tsx`

This task builds the three-zone layout: sidebar, top bar with rapid entry, and main content area.

- [ ] **Step 1: Create the sidebar component**

Create `src/components/gtd/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import {
  Inbox,
  CirclePlay,
  Clock,
  CalendarDays,
  CloudSun,
  BookOpen,
  FolderOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { Project } from "@/generated/prisma/client";

type SidebarNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string; // TaskSection value for drop target
  count?: number;
};

const collectItems: SidebarNavItem[] = [
  { label: "Inbox", href: "/inbox", icon: Inbox, section: "INBOX" },
];

const actionItems: SidebarNavItem[] = [
  { label: "Next", href: "/next", icon: CirclePlay, section: "NEXT" },
  { label: "Waiting", href: "/waiting", icon: Clock, section: "WAITING" },
  { label: "Scheduled", href: "/scheduled", icon: CalendarDays, section: "SCHEDULED" },
  { label: "Someday", href: "/someday", icon: CloudSun, section: "SOMEDAY" },
];

const cleanupItems: SidebarNavItem[] = [
  { label: "Logbook", href: "/logbook", icon: BookOpen, section: "LOGBOOK" },
];

function DroppableNavItem({
  item,
  isActive,
}: {
  item: SidebarNavItem;
  isActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sidebar-${item.section}`,
    data: { section: item.section },
  });

  const Icon = item.icon;

  return (
    <Link
      ref={item.section ? setNodeRef : undefined}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        isOver && "ring-2 ring-primary bg-primary/10"
      )}
    >
      <Icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.count !== undefined && item.count > 0 && (
        <Badge variant="secondary" className="text-xs">
          {item.count}
        </Badge>
      )}
    </Link>
  );
}

export function GtdSidebar({
  projects,
  inboxCount,
  onAddProject,
}: {
  projects: Project[];
  inboxCount: number;
  onAddProject: () => void;
}) {
  const pathname = usePathname();

  const collectWithCount = collectItems.map((item) =>
    item.label === "Inbox" ? { ...item, count: inboxCount } : item
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar p-4">
      {/* COLLECT */}
      <div className="mb-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collect
        </p>
        <nav className="space-y-1">
          {collectWithCount.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>

      <Separator className="mb-4" />

      {/* ACTIONS */}
      <div className="mb-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </p>
        <nav className="space-y-1">
          {actionItems.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>

      <Separator className="mb-4" />

      {/* PROJECTS */}
      <div className="mb-4 flex-1">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </p>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onAddProject}
          >
            <Plus className="size-3" />
          </Button>
        </div>
        <nav className="space-y-1">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `/projects/${project.id}`
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <FolderOpen className="size-4" />
              <span className="truncate">{project.title}</span>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">No projects</p>
          )}
        </nav>
      </div>

      <Separator className="mb-4" />

      {/* CLEANUP */}
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cleanup
        </p>
        <nav className="space-y-1">
          {cleanupItems.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create the rapid entry component**

Create `src/components/gtd/rapid-entry.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { createTask } from "@/actions/tasks";

export function RapidEntry() {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      const input = value.trim();
      setValue("");
      startTransition(async () => {
        await createTask(input);
      });
    }
    if (e.key === "Escape") {
      setValue("");
    }
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Rapid Entry \u2014 type here and hit enter / or esc"
        disabled={isPending}
        className="h-10 pr-10"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-2.5 size-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the GTD layout**

Create `src/app/(gtd)/layout.tsx`:

```tsx
import { GtdLayoutClient } from "@/components/gtd/gtd-layout-client";
import { getActiveProjects } from "@/actions/projects";
import { getInboxCount } from "@/actions/tasks";

export default async function GtdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, inboxCount] = await Promise.all([
    getActiveProjects(),
    getInboxCount(),
  ]);

  return (
    <GtdLayoutClient projects={projects} inboxCount={inboxCount}>
      {children}
    </GtdLayoutClient>
  );
}
```

- [ ] **Step 4: Create the client layout wrapper**

We need a client component wrapper because the sidebar uses `usePathname` and the DnD context must wrap both the sidebar (drop targets) and the main content (drag sources).

Create `src/components/gtd/gtd-layout-client.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GtdSidebar } from "@/components/gtd/sidebar";
import { RapidEntry } from "@/components/gtd/rapid-entry";
import { ProjectFormDialog } from "@/components/gtd/project-form";
import { ScheduledDateDialog } from "@/components/gtd/scheduled-date-dialog";
import { moveTask, reorderTasks } from "@/actions/tasks";
import type { Project, TaskSection } from "@/generated/prisma/client";

export function GtdLayoutClient({
  projects,
  inboxCount,
  children,
}: {
  projects: Project[];
  inboxCount: number;
  children: React.ReactNode;
}) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [scheduledDialog, setScheduledDialog] = useState<{
    taskId: string;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Cross-section drop (onto sidebar)
      if (over.id.toString().startsWith("sidebar-") && overData?.section) {
        const targetSection = overData.section as TaskSection;
        const taskId = active.id as string;

        // If moving to SCHEDULED and no scheduledDate, show dialog
        if (
          targetSection === "SCHEDULED" &&
          activeData?.scheduledDate == null
        ) {
          setScheduledDialog({ taskId });
          return;
        }

        await moveTask(taskId, targetSection);
        return;
      }

      // Within-list reorder
      if (overData?.sortableIds && activeData?.section === overData?.section) {
        const ids = overData.sortableIds as string[];
        await reorderTasks(activeData.section as TaskSection, ids);
      }
    },
    []
  );

  const handleScheduledConfirm = useCallback(
    async (date: Date) => {
      if (scheduledDialog) {
        await moveTask(scheduledDialog.taskId, "SCHEDULED", date);
        setScheduledDialog(null);
      }
    },
    [scheduledDialog]
  );

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen overflow-hidden">
        <GtdSidebar
          projects={projects}
          inboxCount={inboxCount}
          onAddProject={() => setProjectDialogOpen(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b bg-background px-6 py-3">
            <RapidEntry />
          </div>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>

      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
      />
      <ScheduledDateDialog
        open={scheduledDialog !== null}
        onOpenChange={(open) => {
          if (!open) setScheduledDialog(null);
        }}
        onConfirm={handleScheduledConfirm}
      />
      <DragOverlay>
        {activeId ? (
          <div className="rounded-md border bg-background px-4 py-2 shadow-lg">
            Dragging...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 5: Run typecheck**

This will fail because `ProjectFormDialog` and `ScheduledDateDialog` don't exist yet. That's expected — they're created in the next tasks. Verify you get only those missing-module errors:

```bash
npm run typecheck 2>&1 | head -20
```

Expected: Errors referencing `project-form` and `scheduled-date-dialog` only.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(gtd\)/layout.tsx src/components/gtd/sidebar.tsx src/components/gtd/rapid-entry.tsx src/components/gtd/gtd-layout-client.tsx
git commit -m "feat: add GTD layout shell with sidebar, rapid entry, and DnD context"
```

---

## Task 10: Scheduled Date Dialog

**Files:**
- Create: `src/components/gtd/scheduled-date-dialog.tsx`

- [ ] **Step 1: Create the scheduled date dialog component**

Create `src/components/gtd/scheduled-date-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

export function ScheduledDateDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: Date) => void;
}) {
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  function handleConfirm() {
    if (selected) {
      onConfirm(selected);
      setSelected(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pick a scheduled date</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gtd/scheduled-date-dialog.tsx
git commit -m "feat: add scheduled date picker dialog"
```

---

## Task 11: Project Form Dialog

**Files:**
- Create: `src/components/gtd/project-form.tsx`

- [ ] **Step 1: Create the project form dialog**

Create `src/components/gtd/project-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject } from "@/actions/projects";

export function ProjectFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    startTransition(async () => {
      await createProject(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Project title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors (all referenced components now exist).

- [ ] **Step 3: Commit**

```bash
git add src/components/gtd/project-form.tsx
git commit -m "feat: add project form dialog"
```

---

## Task 12: Task Row Component

**Files:**
- Create: `src/components/gtd/task-row.tsx`

- [ ] **Step 1: Create the task row component**

Create `src/components/gtd/task-row.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskDetail } from "@/components/gtd/task-detail";
import { completeTask } from "@/actions/tasks";
import type { TaskWithProject } from "@/types/gtd";

export function TaskRow({
  task,
  projects,
  isDragOverlay,
}: {
  task: TaskWithProject;
  projects: { id: string; title: string }[];
  isDragOverlay?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isCompleting, startTransition] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      section: task.section,
      scheduledDate: task.scheduledDate,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleCheck() {
    startTransition(async () => {
      await completeTask(task.id);
    });
  }

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={cn(
        "rounded-md border bg-background transition-opacity",
        isDragging && "opacity-50",
        isCompleting && "opacity-50 transition-opacity duration-300"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="size-4" />
        </button>

        {/* Checkbox */}
        <Checkbox
          checked={task.section === "LOGBOOK"}
          onCheckedChange={handleCheck}
          disabled={task.section === "LOGBOOK" || isCompleting}
        />

        {/* Title - clickable to expand */}
        <button
          className="flex flex-1 items-center gap-2 text-left text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className={cn(task.section === "LOGBOOK" && "line-through text-muted-foreground")}>
            {task.title}
          </span>
        </button>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          {task.project && (
            <Badge variant="secondary" className="text-xs">
              {task.project.title}
            </Badge>
          )}
          {formattedDueDate && (
            <Badge variant="outline" className="text-xs">
              Due {formattedDueDate}
            </Badge>
          )}
        </div>
      </div>

      {/* Inline expand */}
      {expanded && (
        <TaskDetail task={task} projects={projects} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gtd/task-row.tsx
git commit -m "feat: add task row component with drag handle, checkbox, badges"
```

---

## Task 13: Task Detail (Inline Expand)

**Files:**
- Create: `src/components/gtd/task-detail.tsx`

- [ ] **Step 1: Create the inline task detail component**

Create `src/components/gtd/task-detail.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CalendarDays, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTask } from "@/actions/tasks";
import type { TaskWithProject } from "@/types/gtd";

export function TaskDetail({
  task,
  projects,
}: {
  task: TaskWithProject;
  projects: { id: string; title: string }[];
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [waitingFor, setWaitingFor] = useState(task.waitingFor ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined
  );
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    task.scheduledDate ? new Date(task.scheduledDate) : undefined
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    task.projectId
  );
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: description.trim() || null,
        waitingFor: waitingFor.trim() || null,
        dueDate: dueDate ?? null,
        scheduledDate: scheduledDate ?? null,
        projectId: selectedProjectId,
      });
    });
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="border-t px-10 py-3 space-y-3">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        placeholder="Title"
        className="font-medium"
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={save}
        placeholder="Description"
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* Due date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              {dueDate
                ? dueDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Due date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => {
                setDueDate(date ?? undefined);
                // Save after a tick so state updates
                setTimeout(save, 0);
              }}
            />
            {dueDate && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    setDueDate(undefined);
                    setTimeout(save, 0);
                  }}
                >
                  <X className="size-3" /> Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Scheduled date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              {scheduledDate
                ? scheduledDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Scheduled"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={scheduledDate}
              onSelect={(date) => {
                setScheduledDate(date ?? undefined);
                setTimeout(save, 0);
              }}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
            {scheduledDate && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => {
                    setScheduledDate(undefined);
                    setTimeout(save, 0);
                  }}
                >
                  <X className="size-3" /> Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Waiting for (only relevant context) */}
        <Input
          value={waitingFor}
          onChange={(e) => setWaitingFor(e.target.value)}
          onBlur={save}
          placeholder="Waiting for..."
          className="h-8 w-48 text-sm"
        />

        {/* Project assignment */}
        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={projectPopoverOpen}
              className="w-48 justify-between"
            >
              {selectedProject ? selectedProject.title : "Select project..."}
              <ChevronsUpDown className="ml-2 size-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search projects..." />
              <CommandList>
                <CommandEmpty>No project found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="__none__"
                    onSelect={() => {
                      setSelectedProjectId(null);
                      setProjectPopoverOpen(false);
                      setTimeout(save, 0);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-3.5",
                        selectedProjectId === null ? "opacity-100" : "opacity-0"
                      )}
                    />
                    None
                  </CommandItem>
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={project.title}
                      onSelect={() => {
                        setSelectedProjectId(project.id);
                        setProjectPopoverOpen(false);
                        setTimeout(save, 0);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-3.5",
                          selectedProjectId === project.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {project.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/gtd/task-detail.tsx
git commit -m "feat: add inline task detail component with editable fields"
```

---

## Task 14: Task List with Drag-and-Drop

**Files:**
- Create: `src/components/gtd/task-list.tsx`

- [ ] **Step 1: Create the sortable task list component**

Create `src/components/gtd/task-list.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskRow } from "@/components/gtd/task-row";
import type { TaskWithProject } from "@/types/gtd";

export function TaskList({
  tasks,
  projects,
  sectionId,
}: {
  tasks: TaskWithProject[];
  projects: { id: string; title: string }[];
  sectionId: string;
}) {
  const { setNodeRef } = useDroppable({
    id: `list-${sectionId}`,
    data: {
      section: sectionId,
      sortableIds: tasks.map((t) => t.id),
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="space-y-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projects={projects} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks
          </p>
        )}
      </div>
    </SortableContext>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/gtd/task-list.tsx
git commit -m "feat: add sortable task list component with dnd-kit"
```

---

## Task 15: Section Pages — Inbox, Next, Waiting, Scheduled, Someday

**Files:**
- Create: `src/app/(gtd)/inbox/page.tsx`
- Create: `src/app/(gtd)/next/page.tsx`
- Create: `src/app/(gtd)/waiting/page.tsx`
- Create: `src/app/(gtd)/scheduled/page.tsx`
- Create: `src/app/(gtd)/someday/page.tsx`

- [ ] **Step 1: Create the inbox page**

Create `src/app/(gtd)/inbox/page.tsx`:

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function InboxPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("INBOX"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Inbox</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="INBOX"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the next page**

Create `src/app/(gtd)/next/page.tsx`:

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function NextPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("NEXT"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Next Actions</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="NEXT"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the waiting page**

Create `src/app/(gtd)/waiting/page.tsx`:

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function WaitingPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("WAITING"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Waiting</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="WAITING"
      />
    </div>
  );
}
```

- [ ] **Step 4: Create the scheduled page**

Create `src/app/(gtd)/scheduled/page.tsx`:

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function ScheduledPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("SCHEDULED"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Scheduled</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="SCHEDULED"
      />
    </div>
  );
}
```

- [ ] **Step 5: Create the someday page**

Create `src/app/(gtd)/someday/page.tsx`:

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function SomedayPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("SOMEDAY"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Someday</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="SOMEDAY"
      />
    </div>
  );
}
```

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(gtd\)/inbox src/app/\(gtd\)/next src/app/\(gtd\)/waiting src/app/\(gtd\)/scheduled src/app/\(gtd\)/someday
git commit -m "feat: add section pages (inbox, next, waiting, scheduled, someday)"
```

---

## Task 16: Logbook Page

**Files:**
- Create: `src/app/(gtd)/logbook/page.tsx`

- [ ] **Step 1: Create the logbook page**

Create `src/app/(gtd)/logbook/page.tsx`:

```tsx
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export default async function LogbookPage() {
  const tasks = await db.task.findMany({
    where: { section: "LOGBOOK" },
    orderBy: { completedAt: "desc" },
    include: { project: true },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Logbook</h1>
      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No completed tasks
        </p>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-md border px-4 py-2"
            >
              <span className="flex-1 text-sm line-through text-muted-foreground">
                {task.title}
              </span>
              <div className="flex items-center gap-1.5">
                {task.project && (
                  <Badge variant="secondary" className="text-xs">
                    {task.project.title}
                  </Badge>
                )}
                {task.completedAt && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(task.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(gtd\)/logbook
git commit -m "feat: add logbook page for completed tasks"
```

---

## Task 17: Project Detail Page

**Files:**
- Create: `src/app/(gtd)/projects/[id]/page.tsx`

- [ ] **Step 1: Create the project detail page**

Create `src/app/(gtd)/projects/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getProjectWithTasks } from "@/actions/projects";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";
import { Separator } from "@/components/ui/separator";
import type { TaskSection } from "@/generated/prisma/client";

const sectionLabels: Record<string, string> = {
  INBOX: "Inbox",
  NEXT: "Next",
  WAITING: "Waiting",
  SCHEDULED: "Scheduled",
  SOMEDAY: "Someday",
};

const sectionOrder: TaskSection[] = ["INBOX", "NEXT", "WAITING", "SCHEDULED", "SOMEDAY"];

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, allProjects] = await Promise.all([
    getProjectWithTasks(id),
    getActiveProjects(),
  ]);

  if (!project) {
    notFound();
  }

  const projectList = allProjects.map((p) => ({ id: p.id, title: p.title }));

  // Group tasks by section
  const tasksBySection = sectionOrder
    .map((section) => ({
      section,
      label: sectionLabels[section],
      tasks: project.tasks.filter((t) => t.section === section),
    }))
    .filter((group) => group.tasks.length > 0);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{project.title}</h1>
      {project.description && (
        <p className="mb-4 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}
      <Separator className="mb-6" />

      {tasksBySection.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tasks in this project
        </p>
      ) : (
        <div className="space-y-6">
          {tasksBySection.map(({ section, label, tasks }) => (
            <div key={section}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </h2>
              <TaskList
                tasks={tasks}
                projects={projectList}
                sectionId={section}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(gtd\)/projects
git commit -m "feat: add project detail page with tasks grouped by section"
```

---

## Task 18: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: No type errors.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors that appear.

- [ ] **Step 3: Run dev server and verify**

```bash
npm run dev
```

Manual checks:
1. Visit `http://localhost:3000` — should redirect to `/inbox`
2. Sidebar shows all sections (Collect > Inbox, Actions > Next/Waiting/Scheduled/Someday, Cleanup > Logbook)
3. Rapid Entry: type a sentence, press Enter — should show spinner, then task appears in Inbox (requires Azure OpenAI env vars configured; if not configured, task still appears with raw text as title)
4. Click a task row — should expand inline with editable fields
5. Drag a task within the list — should reorder
6. Drag a task to a sidebar section — should move it
7. Drag a task to "Scheduled" — should show date picker dialog
8. Check a task's checkbox — should move to Logbook
9. Click "+" next to Projects — should show project creation dialog
10. Create a project, assign a task to it via inline expand, click project in sidebar

- [ ] **Step 4: Fix any issues found during manual testing**

Address any runtime errors, layout issues, or behavior bugs.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

(Only if there were fixes needed.)
