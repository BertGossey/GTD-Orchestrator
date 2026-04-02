# Task Counters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add count badges to Next, Waiting, Scheduled, Someday sections and Projects in the sidebar.

**Architecture:** Server-side count queries in layout, parallel execution with Promise.all, pass counts down to sidebar component via props.

**Tech Stack:** Next.js 15 Server Components, Prisma count aggregations, React props, shadcn/ui Badge component

---

## File Structure

**Files to modify:**
- `src/actions/tasks.ts` - Add getSectionCounts server action
- `src/actions/tasks.test.ts` - Add tests for getSectionCounts
- `src/actions/projects.ts` - Add getProjectTaskCounts server action  
- `src/actions/projects.test.ts` - Add tests for getProjectTaskCounts
- `src/app/(gtd)/layout.tsx` - Fetch counts and pass to client component
- `src/components/gtd/gtd-layout-client.tsx` - Accept counts props and pass to sidebar
- `src/components/gtd/sidebar.tsx` - Display count badges in UI

---

## Task 1: Add getSectionCounts Server Action with Tests

**Files:**
- Modify: `src/actions/tasks.ts`
- Modify: `src/actions/tasks.test.ts`

- [ ] **Step 1: Write failing test for getSectionCounts**

Add this test to `src/actions/tasks.test.ts` at the end of the file (before the closing of the describe block):

```typescript
describe("getSectionCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns counts for all action sections", async () => {
    vi.mocked(db.task.count)
      .mockResolvedValueOnce(5) // NEXT
      .mockResolvedValueOnce(3) // WAITING
      .mockResolvedValueOnce(7) // SCHEDULED
      .mockResolvedValueOnce(2); // SOMEDAY

    const result = await getSectionCounts();

    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "NEXT" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "WAITING" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "SCHEDULED" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "SOMEDAY" } });
    expect(result).toEqual({
      next: 5,
      waiting: 3,
      scheduled: 7,
      someday: 2,
    });
  });
});
```

- [ ] **Step 2: Update imports in tasks.test.ts**

Add `getSectionCounts` to the import statement from "./tasks":

```typescript
import {
  createTask,
  updateTask,
  moveTask,
  reorderTasks,
  completeTask,
  getTasksBySection,
  getInboxCount,
  deleteTask,
  getSectionCounts,
} from "./tasks";
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npm test -- src/actions/tasks.test.ts
```

Expected: FAIL with "getSectionCounts is not a function" or similar

- [ ] **Step 4: Implement getSectionCounts function**

Add this function to `src/actions/tasks.ts` after the `getInboxCount` function:

```typescript
export async function getSectionCounts() {
  const [next, waiting, scheduled, someday] = await Promise.all([
    db.task.count({ where: { section: "NEXT" } }),
    db.task.count({ where: { section: "WAITING" } }),
    db.task.count({ where: { section: "SCHEDULED" } }),
    db.task.count({ where: { section: "SOMEDAY" } }),
  ]);

  return { next, waiting, scheduled, someday };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
npm test -- src/actions/tasks.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: add getSectionCounts server action with tests

- Add getSectionCounts function to query Next/Waiting/Scheduled/Someday counts
- Queries run in parallel using Promise.all
- Add comprehensive test coverage

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add getProjectTaskCounts Server Action with Tests

**Files:**
- Modify: `src/actions/projects.ts`
- Modify: `src/actions/projects.test.ts`

- [ ] **Step 1: Write failing test for getProjectTaskCounts**

Add this test to `src/actions/projects.test.ts` at the end of the file:

```typescript
describe("getProjectTaskCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns task counts for all active projects", async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: "p1", _count: { tasks: 5 } },
      { id: "p2", _count: { tasks: 3 } },
      { id: "p3", _count: { tasks: 0 } },
    ] as never);

    const result = await getProjectTaskCounts();

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        _count: {
          select: { tasks: true },
        },
      },
    });
    expect(result).toEqual({
      p1: 5,
      p2: 3,
      p3: 0,
    });
  });

  it("returns empty object when no projects exist", async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([] as never);

    const result = await getProjectTaskCounts();

    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Update imports in projects.test.ts**

Add `getProjectTaskCounts` to the import statement from "./projects":

```typescript
import {
  createProject,
  updateProject,
  getActiveProjects,
  getProjectWithTasks,
  deleteProject,
  getProjectTaskCounts,
} from "./projects";
```

- [ ] **Step 3: Run test to verify it fails**

Run:
```bash
npm test -- src/actions/projects.test.ts
```

Expected: FAIL with "getProjectTaskCounts is not a function" or similar

- [ ] **Step 4: Implement getProjectTaskCounts function**

Add this function to `src/actions/projects.ts` after the `getProjectWithTasks` function:

```typescript
export async function getProjectTaskCounts() {
  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      _count: {
        select: { tasks: true },
      },
    },
  });

  return projects.reduce((acc, p) => {
    acc[p.id] = p._count.tasks;
    return acc;
  }, {} as Record<string, number>);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:
```bash
npm test -- src/actions/projects.test.ts
```

Expected: All tests PASS

- [ ] **Step 6: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/actions/projects.ts src/actions/projects.test.ts
git commit -m "feat: add getProjectTaskCounts server action with tests

- Add getProjectTaskCounts function to query task counts per active project
- Uses Prisma _count aggregation for efficiency
- Add comprehensive test coverage including empty case

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update Layout to Fetch Counts

**Files:**
- Modify: `src/app/(gtd)/layout.tsx`

- [ ] **Step 1: Update imports in layout.tsx**

At the top of the file, update the imports to include the new functions:

```typescript
import { GtdLayoutClient } from "@/components/gtd/gtd-layout-client";
import { getActiveProjects, getProjectTaskCounts } from "@/actions/projects";
import { getInboxCount, getSectionCounts } from "@/actions/tasks";
```

- [ ] **Step 2: Update GtdLayout function to fetch counts**

Replace the existing function body with:

```typescript
export default async function GtdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, inboxCount, sectionCounts, projectCounts] = await Promise.all([
    getActiveProjects(),
    getInboxCount(),
    getSectionCounts(),
    getProjectTaskCounts(),
  ]);

  return (
    <GtdLayoutClient
      projects={projects}
      inboxCount={inboxCount}
      sectionCounts={sectionCounts}
      projectCounts={projectCounts}
    >
      {children}
    </GtdLayoutClient>
  );
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: Will show errors about GtdLayoutClient props - this is expected and will be fixed in next task

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/layout.tsx
git commit -m "feat: fetch section and project counts in layout

- Add getSectionCounts and getProjectTaskCounts to parallel queries
- Pass counts to GtdLayoutClient (props will be updated next)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update GtdLayoutClient to Accept and Pass Counts

**Files:**
- Modify: `src/components/gtd/gtd-layout-client.tsx`

- [ ] **Step 1: Update GtdLayoutClient props interface**

Update the component props at lines 19-27:

```typescript
export function GtdLayoutClient({
  projects,
  inboxCount,
  sectionCounts,
  projectCounts,
  children,
}: {
  projects: Project[];
  inboxCount: number;
  sectionCounts: { next: number; waiting: number; scheduled: number; someday: number };
  projectCounts: Record<string, number>;
  children: React.ReactNode;
}) {
```

- [ ] **Step 2: Pass counts to GtdSidebar**

Update the GtdSidebar component call at lines 95-99:

```typescript
        <GtdSidebar
          projects={projects}
          inboxCount={inboxCount}
          sectionCounts={sectionCounts}
          projectCounts={projectCounts}
          onAddProject={() => setProjectDialogOpen(true)}
        />
```

- [ ] **Step 3: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: Will show errors about GtdSidebar props - this is expected and will be fixed in next task

- [ ] **Step 4: Commit**

```bash
git add src/components/gtd/gtd-layout-client.tsx
git commit -m "feat: pass section and project counts to sidebar

- Update GtdLayoutClient to accept sectionCounts and projectCounts props
- Pass counts down to GtdSidebar component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Update Sidebar to Display Count Badges

**Files:**
- Modify: `src/components/gtd/sidebar.tsx`

- [ ] **Step 1: Update GtdSidebar props interface**

Update the component props at lines 82-90:

```typescript
export function GtdSidebar({
  projects,
  inboxCount,
  sectionCounts,
  projectCounts,
  onAddProject,
}: {
  projects: Project[];
  inboxCount: number;
  sectionCounts: { next: number; waiting: number; scheduled: number; someday: number };
  projectCounts: Record<string, number>;
  onAddProject: () => void;
}) {
```

- [ ] **Step 2: Map section counts to action items**

After the `collectWithCount` variable (around line 95), add:

```typescript
  const actionItemsWithCounts = actionItems.map((item) => {
    const countKey = item.label.toLowerCase() as keyof typeof sectionCounts;
    return { ...item, count: sectionCounts[countKey] };
  });
```

- [ ] **Step 3: Update action items rendering**

Change the mapping at line 121 from `actionItems.map` to `actionItemsWithCounts.map`:

```typescript
          {actionItemsWithCounts.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
```

- [ ] **Step 4: Add count Badge to project links**

Update the project links at lines 143-157 to:

```typescript
          {projects.map((project) => {
            const taskCount = projectCounts[project.id] || 0;
            return (
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
                <span className="flex-1 truncate">{project.title}</span>
                {taskCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {taskCount}
                  </Badge>
                )}
              </Link>
            );
          })}
```

- [ ] **Step 5: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 6: Verify production build**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 7: Start dev server for manual testing**

Run:
```bash
npm run dev
```

Expected: Server starts on localhost:3003

- [ ] **Step 8: Manual test - View sidebar with counts**

Navigate to: `http://localhost:3003/inbox`

Expected:
- Inbox count displays (existing functionality)
- Next, Waiting, Scheduled, Someday sections show count badges (if tasks exist)
- Projects show count badges (if tasks exist)
- Counts only display when > 0
- Badge styling matches inbox count

- [ ] **Step 9: Manual test - Verify count accuracy**

1. Check count numbers match actual tasks in each section
2. Verify project counts match tasks in each project
3. Verify sections/projects with 0 tasks show no badge

Expected: All counts are accurate

- [ ] **Step 10: Manual test - Verify count updates**

1. Move a task from Inbox to Next
2. Navigate to another page and back
3. Verify counts have updated

Expected: Counts update after revalidation

- [ ] **Step 11: Stop dev server**

Press `Ctrl+C` in terminal

- [ ] **Step 12: Commit**

```bash
git add src/components/gtd/sidebar.tsx
git commit -m "feat: display count badges in sidebar

- Add count badges to Next/Waiting/Scheduled/Someday sections
- Add count badges to all projects
- Badges only show when count > 0
- Use same Badge styling as existing inbox count

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Push Changes

**Files:**
- None (git operation)

- [ ] **Step 1: Push commits to remote**

Run:
```bash
git push
```

Expected: All commits pushed successfully

---

## Completion Checklist

- [x] getSectionCounts server action added with tests
- [x] getProjectTaskCounts server action added with tests
- [x] Layout fetches counts in parallel
- [x] GtdLayoutClient passes counts to sidebar
- [x] Sidebar displays count badges for action sections
- [x] Sidebar displays count badges for projects
- [x] Badges only show when count > 0
- [x] Visual styling matches existing inbox count
- [x] TypeScript compilation passes
- [x] Production build succeeds
- [x] Manual testing completed
- [x] All changes committed and pushed
