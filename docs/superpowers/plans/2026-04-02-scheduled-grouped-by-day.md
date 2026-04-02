# Scheduled View Grouped by Day — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group tasks on the Scheduled page by date, with a styled date divider (workday vs weekend colour) above each group.

**Architecture:** Two changes: (1) add an optional `droppableId` prop to `TaskList` so multiple instances on the same page have unique dnd-kit droppable IDs, (2) rewrite `ScheduledPage` to group tasks by `scheduledDate` and render a date divider + `TaskList` per group. The shared `DndContext` and the `reorderTasks` handler are untouched.

**Tech Stack:** Next.js 15 App Router, dnd-kit, Tailwind CSS, TypeScript

---

### Task 1: Add optional `droppableId` prop to `TaskList`

**Files:**
- Modify: `src/components/gtd/task-list.tsx`

**Why this is needed:** The Scheduled page will render multiple `TaskList` instances. Each uses `useDroppable({ id: \`list-${sectionId}\` })`. With all groups using `sectionId="SCHEDULED"`, every droppable would have the same ID (`"list-SCHEDULED"`), causing dnd-kit to misidentify which group's `sortableIds` to use when computing reorder. The `droppableId` prop lets the caller override the droppable ID while keeping `section: sectionId` in the droppable data (which is what the `reorderTasks` handler uses).

- [ ] **Step 1: Update `src/components/gtd/task-list.tsx`**

Replace the full file contents with:

```tsx
"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskRow } from "@/components/gtd/task-row";
import type { TaskWithProject } from "@/types/gtd";

export function TaskList({
  tasks,
  projects,
  sectionId,
  droppableId,
}: {
  tasks: TaskWithProject[];
  projects: { id: string; title: string }[];
  sectionId: string;
  droppableId?: string;
}) {
  const { setNodeRef } = useDroppable({
    id: droppableId ?? `list-${sectionId}`,
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/gtd/task-list.tsx
git commit -m "feat: add optional droppableId prop to TaskList"
```

---

### Task 2: Update `ScheduledPage` — group tasks by day with date dividers

**Files:**
- Modify: `src/app/(gtd)/scheduled/page.tsx`

- [ ] **Step 1: Replace `src/app/(gtd)/scheduled/page.tsx` with the full implementation**

```tsx
import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/gtd";

function groupTasksByDate(
  tasks: TaskWithProject[]
): { dateKey: string; tasks: TaskWithProject[] }[] {
  const groups = new Map<string, TaskWithProject[]>();
  for (const task of tasks) {
    if (!task.scheduledDate) continue;
    const dateKey = task.scheduledDate.toISOString().split("T")[0];
    const group = groups.get(dateKey) ?? [];
    group.push(task);
    groups.set(dateKey, group);
  }
  return Array.from(groups.entries()).map(([dateKey, tasks]) => ({
    dateKey,
    tasks,
  }));
}

function formatDate(dateKey: string): string {
  // Use noon UTC to avoid local-timezone date shifts when formatting
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isWeekend(dateKey: string): boolean {
  const day = new Date(dateKey).getUTCDay();
  return day === 0 || day === 6;
}

export default async function ScheduledPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("SCHEDULED"),
    getActiveProjects(),
  ]);

  const projectList = projects.map((p) => ({ id: p.id, title: p.title }));
  const groups = groupTasksByDate(tasks);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Scheduled</h1>
      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scheduled tasks
        </p>
      ) : (
        <div>
          {groups.map(({ dateKey, tasks: dayTasks }, index) => (
            <div key={dateKey}>
              <div
                className={cn(
                  "border-l-2 px-3 py-2 rounded-sm text-sm font-medium mb-2",
                  index > 0 && "mt-4",
                  isWeekend(dateKey)
                    ? "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                    : "border-primary bg-primary/5 text-foreground"
                )}
              >
                {formatDate(dateKey)}
              </div>
              <TaskList
                tasks={dayTasks}
                projects={projectList}
                sectionId="SCHEDULED"
                droppableId={`SCHEDULED-${dateKey}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Smoke test in the browser**

Start the dev server (`npm run dev`) and navigate to `http://localhost:3003/scheduled`. Confirm:
- Tasks are grouped under their scheduled date.
- Each date shows the full day name and date (e.g. "Monday, April 7").
- Workday groups have a teal left border and light teal background.
- Weekend groups have a muted left border and grey background.
- Only dates with tasks appear.
- Dragging a task within a day group reorders it correctly.
- If there are no scheduled tasks, "No scheduled tasks" appears.

- [ ] **Step 5: Commit**

```bash
git add src/app/(gtd)/scheduled/page.tsx
git commit -m "feat: group scheduled tasks by day with workday/weekend dividers"
```
