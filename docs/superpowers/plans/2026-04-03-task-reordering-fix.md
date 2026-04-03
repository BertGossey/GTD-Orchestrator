# Task Reordering Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix within-section task drag-and-drop reordering so order persists to database

**Architecture:** Add React Context to pass task list from pages to layout, detect task-to-task drops in same section, compute new order using arrayMove, call existing reorderTasks server action

**Tech Stack:** React Context API, @dnd-kit/core, @dnd-kit/sortable, Next.js 15, TypeScript

---

## File Structure

**New files:**
- `src/contexts/tasks-context.tsx` - React Context for sharing task list between pages and layout
- `src/components/gtd/task-list-with-provider.tsx` - Client wrapper that populates context on mount

**Modified files:**
- `src/components/gtd/gtd-layout-client.tsx:38-80` - Add within-section reorder logic to handleDragEnd
- `src/app/(gtd)/layout.tsx:1-40` - Wrap children in TasksProvider
- `src/app/(gtd)/inbox/page.tsx:1-22` - Use TaskListWithProvider instead of TaskList
- `src/app/(gtd)/next/page.tsx:1-22` - Use TaskListWithProvider instead of TaskList  
- `src/app/(gtd)/waiting/page.tsx:1-22` - Use TaskListWithProvider instead of TaskList
- `src/app/(gtd)/someday/page.tsx:1-22` - Use TaskListWithProvider instead of TaskList

---

### Task 1: Create TasksContext

**Files:**
- Create: `src/contexts/tasks-context.tsx`

- [ ] **Step 1: Create context file with provider and hook**

```typescript
"use client";

import { createContext, useContext, useState } from "react";
import type { TaskWithProject } from "@/types/gtd";

type TasksContextType = {
  tasks: TaskWithProject[];
  setTasks: (tasks: TaskWithProject[]) => void;
};

const TasksContext = createContext<TasksContextType | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  
  return (
    <TasksContext.Provider value={{ tasks, setTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return context;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/contexts/tasks-context.tsx
git commit -m "feat: add TasksContext for sharing task list with layout"
```

---

### Task 2: Create TaskListWithProvider wrapper

**Files:**
- Create: `src/components/gtd/task-list-with-provider.tsx`

- [ ] **Step 1: Create wrapper component that populates context**

```typescript
"use client";

import { useEffect } from "react";
import { useTasks } from "@/contexts/tasks-context";
import { TaskList } from "@/components/gtd/task-list";
import type { TaskWithProject } from "@/types/gtd";

export function TaskListWithProvider({
  tasks,
  projects,
  sectionId,
}: {
  tasks: TaskWithProject[];
  projects: { id: string; title: string }[];
  sectionId: string;
}) {
  const { setTasks } = useTasks();

  useEffect(() => {
    setTasks(tasks);
  }, [tasks, setTasks]);

  return <TaskList tasks={tasks} projects={projects} sectionId={sectionId} />;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/gtd/task-list-with-provider.tsx
git commit -m "feat: add TaskListWithProvider to populate context on mount"
```

---

### Task 3: Wrap layout children in TasksProvider

**Files:**
- Modify: `src/app/(gtd)/layout.tsx:1-40`

- [ ] **Step 1: Import TasksProvider at top of file**

Add import after existing imports:
```typescript
import { TasksProvider } from "@/contexts/tasks-context";
```

- [ ] **Step 2: Wrap GtdLayoutClient children in TasksProvider**

Find the return statement (around line 29) and wrap the GtdLayoutClient in TasksProvider:

Before:
```typescript
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
```

After:
```typescript
return (
  <TasksProvider>
    <GtdLayoutClient
      projects={projects}
      inboxCount={inboxCount}
      sectionCounts={sectionCounts}
      projectCounts={projectCounts}
    >
      {children}
    </GtdLayoutClient>
  </TasksProvider>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/layout.tsx
git commit -m "feat: wrap layout children in TasksProvider"
```

---

### Task 4: Update inbox page to use TaskListWithProvider

**Files:**
- Modify: `src/app/(gtd)/inbox/page.tsx:1-22`

- [ ] **Step 1: Replace TaskList import with TaskListWithProvider**

Change line 3 from:
```typescript
import { TaskList } from "@/components/gtd/task-list";
```

To:
```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";
```

- [ ] **Step 2: Replace TaskList component with TaskListWithProvider**

Change line 14 from:
```typescript
<TaskList
```

To:
```typescript
<TaskListWithProvider
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/inbox/page.tsx
git commit -m "feat: update inbox page to use TaskListWithProvider"
```

---

### Task 5: Update next page to use TaskListWithProvider

**Files:**
- Modify: `src/app/(gtd)/next/page.tsx:1-22`

- [ ] **Step 1: Replace TaskList import with TaskListWithProvider**

Change line 3 from:
```typescript
import { TaskList } from "@/components/gtd/task-list";
```

To:
```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";
```

- [ ] **Step 2: Replace TaskList component with TaskListWithProvider**

Change line 14 from:
```typescript
<TaskList
```

To:
```typescript
<TaskListWithProvider
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/next/page.tsx
git commit -m "feat: update next page to use TaskListWithProvider"
```

---

### Task 6: Update waiting page to use TaskListWithProvider

**Files:**
- Modify: `src/app/(gtd)/waiting/page.tsx:1-22`

- [ ] **Step 1: Replace TaskList import with TaskListWithProvider**

Change line 3 from:
```typescript
import { TaskList } from "@/components/gtd/task-list";
```

To:
```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";
```

- [ ] **Step 2: Replace TaskList component with TaskListWithProvider**

Change line 14 from:
```typescript
<TaskList
```

To:
```typescript
<TaskListWithProvider
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/waiting/page.tsx
git commit -m "feat: update waiting page to use TaskListWithProvider"
```

---

### Task 7: Update someday page to use TaskListWithProvider

**Files:**
- Modify: `src/app/(gtd)/someday/page.tsx:1-22`

- [ ] **Step 1: Replace TaskList import with TaskListWithProvider**

Change line 3 from:
```typescript
import { TaskList } from "@/components/gtd/task-list";
```

To:
```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";
```

- [ ] **Step 2: Replace TaskList component with TaskListWithProvider**

Change line 14 from:
```typescript
<TaskList
```

To:
```typescript
<TaskListWithProvider
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(gtd\)/someday/page.tsx
git commit -m "feat: update someday page to use TaskListWithProvider"
```

---

### Task 8: Add within-section reorder logic to GtdLayoutClient

**Files:**
- Modify: `src/components/gtd/gtd-layout-client.tsx:1-135`

- [ ] **Step 1: Import useTasks hook at top of file**

Add after line 11 (after other imports):
```typescript
import { useTasks } from "@/contexts/tasks-context";
```

- [ ] **Step 2: Read tasks from context in component body**

Add after line 36 (after const [activeId, setActiveId] = useState...):
```typescript
const { tasks } = useTasks();
```

- [ ] **Step 3: Add within-section reorder logic to handleDragEnd**

Find the handleDragEnd function (around line 42). After the cross-section drop logic (after line 66, before the closing brace on line 78), add this new logic:

```typescript
// Within-section reorder
if (
  activeData?.section &&
  overData?.section &&
  activeData.section === overData.section
) {
  const section = activeData.section as TaskSection;
  
  // Skip reordering for SCHEDULED section (ordered by date, not sortOrder)
  if (section === "SCHEDULED") return;
  
  // Get current task IDs for this section
  const sectionTasks = tasks.filter((t) => t.section === section);
  const taskIds = sectionTasks.map((t) => t.id);
  
  const oldIndex = taskIds.indexOf(active.id as string);
  const newIndex = taskIds.indexOf(over.id as string);
  
  // If dropped on self, nothing to do
  if (oldIndex === newIndex) return;
  
  // Both indices must be valid
  if (oldIndex === -1 || newIndex === -1) return;
  
  // Compute new order
  const newOrder = arrayMove(taskIds, oldIndex, newIndex);
  
  // Persist to database
  await reorderTasks(section, newOrder);
  return;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/gtd/gtd-layout-client.tsx
git commit -m "feat: add within-section reorder logic to handleDragEnd"
```

---

### Task 9: Manual testing - Basic reordering

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3003

- [ ] **Step 2: Open Inbox page in browser**

Navigate to: http://localhost:3003/inbox

- [ ] **Step 3: Create 3+ test tasks if needed**

Use the rapid entry form to create at least 3 tasks in Inbox

- [ ] **Step 4: Test basic reordering**

1. Drag the first task and drop it on the third task
2. Observe: Task should move to new position and stay there
3. Open browser DevTools → Network tab
4. Drag another task to reorder
5. Verify: You see a server action request in Network tab

- [ ] **Step 5: Test persistence**

1. Refresh the page (F5)
2. Verify: Tasks remain in the reordered positions

- [ ] **Step 6: Document results**

If all tests pass, continue to next task. If any fail, note the failure and debug before continuing.

---

### Task 10: Manual testing - Cross-section still works

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Test sidebar drag (Inbox → Next)**

1. Open Inbox page
2. Drag a task from the list
3. Drop it on "Next Actions" in the sidebar
4. Verify: Task moves to Next section
5. Check Network tab: Verify moveTask request appears

- [ ] **Step 2: Navigate to Next page and verify**

1. Click "Next Actions" in sidebar
2. Verify: The moved task appears in the list

- [ ] **Step 3: Test within-section reordering in Next**

1. Drag a task to reorder it within Next section
2. Verify: Order persists after reorder
3. Verify: Network request appears

- [ ] **Step 4: Document results**

If all tests pass, continue to next task. If any fail, note the failure and debug.

---

### Task 11: Manual testing - Edge cases

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Test dragging to first position**

1. In Inbox, drag the third task and drop it on the first task
2. Verify: Task moves to first position and persists

- [ ] **Step 2: Test dragging to last position**

1. Drag the first task and drop it on the last task
2. Verify: Task moves to last position and persists

- [ ] **Step 3: Test Scheduled section (should not reorder)**

1. Navigate to Scheduled section (http://localhost:3003/scheduled)
2. If there are tasks, try to drag and reorder them
3. Verify: Tasks should not reorder within the section (they're date-ordered)
4. Cross-section moves should still work (drag to sidebar)

- [ ] **Step 4: Test multiple sections**

1. Test reordering in Waiting section
2. Test reordering in Someday section
3. Verify both work correctly

- [ ] **Step 5: Document results**

If all tests pass, continue to final commit. If any fail, note the failure and debug.

---

### Task 12: Final verification and commit

**Files:**
- Test: All files

- [ ] **Step 1: Run final typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors or only minor warnings

- [ ] **Step 3: Review git status**

Run: `git status`
Expected: All changes committed, working tree clean

- [ ] **Step 4: Review commit log**

Run: `git log --oneline -10`
Expected: See all commits from this implementation

- [ ] **Step 5: Create summary document**

Create a brief summary of what was fixed and how to verify it works. This can go in a comment on the related issue/ticket, or in the PR description when creating a PR.

Summary should include:
- What was broken: Within-section reordering didn't persist
- Root cause: handleDragEnd only detected drops on container, not on task items
- Solution: Added TasksContext, detect task-to-task drops, call reorderTasks
- How to verify: Drag tasks within any section (Inbox, Next, Waiting, Someday), order persists after refresh

---

## Success Criteria

✓ Users can drag tasks to reorder them within Inbox, Next, Waiting, and Someday sections  
✓ Order persists across page refreshes  
✓ Network tab shows reorderTasks requests for within-section drops  
✓ Cross-section moves (drag to sidebar) continue to work as before  
✓ Scheduled section remains date-ordered (reordering disabled)  
✓ No TypeScript errors  
✓ No console errors during drag operations

---

**Implementation complete!** All tasks checked off = feature is ready for code review and merge.
