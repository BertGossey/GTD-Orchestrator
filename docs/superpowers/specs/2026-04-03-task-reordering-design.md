# Task Reordering Bug Fix - Design Specification

**Date:** 2026-04-03  
**Status:** Approved  
**Feature:** Fix within-section task drag-and-drop reordering

## Problem Statement

Users can drag tasks between sections (Inbox → Next, etc.) successfully, but dragging tasks to reorder them within a single section doesn't persist. The task moves during the drag operation but snaps back to its original position when dropped. Network inspection shows that reorder requests are sent for cross-section moves but NOT for within-section reordering.

### Current Behavior
- **Cross-section drag:** Works correctly, persists to database
- **Within-section reordering:** Visual feedback works, but order doesn't persist
- **Console:** No JavaScript errors
- **Network:** No server action calls for within-section drops

### Root Cause

The `handleDragEnd` logic in `gtd-layout-client.tsx` (lines 68-77) only handles reordering when `over.data.current?.sortableIds` exists. This property exists on the droppable list container, not on individual sortable task items. When users drag a task and drop it onto another task (the most common interaction pattern), the `over` target is the task element, not the container - so the reordering code path never executes.

## Solution Architecture

### Overview

Fix the drop detection logic to recognize when a user drops a task onto another task within the same section. Compute the new order and call the existing `reorderTasks` server action.

### Key Components

1. **TasksContext** (new)
   - React Context to pass current page's task list to the layout
   - Pages populate context with their tasks
   - Layout reads from context during drag operations

2. **GtdLayoutClient** (modified)
   - Add new drop detection logic for task-to-task drops
   - Keep existing container-based logic as fallback
   - Access task list from TasksContext during drag

3. **Page components** (modified)
   - Wrap content in TasksProvider
   - Populate context with task list from server

4. **handleDragEnd** (modified)
   - Add logic branch for within-section reordering
   - Detect: both active and over are tasks in same section
   - Compute new order using `arrayMove`
   - Call `reorderTasks` server action

### Data Flow

```
User drags task A and drops on task B
  ↓
handleDragEnd fires
  ↓
Check 1: Is this a sidebar drop? (over.id starts with "sidebar-")
  → YES: Cross-section move (existing logic)
  → NO: Continue to Check 2
  ↓
Check 2: Are both active and over tasks in the same section?
  → YES: Within-section reorder (new logic)
  → NO: Invalid drop, return early
  ↓
Get task list for this section from TasksContext
  ↓
Find oldIndex = taskIds.indexOf(activeId)
Find newIndex = taskIds.indexOf(overId)
  ↓
If oldIndex === newIndex, return early (dropped on self)
  ↓
Compute newOrder = arrayMove(taskIds, oldIndex, newIndex)
  ↓
Call reorderTasks(section, newOrder)
  ↓
Server updates sortOrder in transaction
  ↓
Revalidate path, page re-renders with new order
```

## Implementation Details

### 1. Create TasksContext

**File:** `src/contexts/tasks-context.tsx` (new)

```typescript
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

### 2. Update GtdLayoutClient

**File:** `src/components/gtd/gtd-layout-client.tsx`

**Changes:**
- Import `useTasks` hook
- Read `tasks` from context
- Modify `handleDragEnd` to add within-section reorder logic

**New logic in handleDragEnd:**

```typescript
// After existing cross-section logic, before return
// Within-section reorder (new logic)
if (
  activeData?.section &&
  overData?.section &&
  activeData.section === overData.section
) {
  const section = activeData.section as TaskSection;
  
  // Skip reordering for SCHEDULED section (ordered by date, not sortOrder)
  if (section === "SCHEDULED") return;
  
  // Get current task IDs for this section
  const sectionTasks = tasks.filter(t => t.section === section);
  const taskIds = sectionTasks.map(t => t.id);
  
  const oldIndex = taskIds.indexOf(active.id as string);
  const newIndex = taskIds.indexOf(over.id as string);
  
  // If dropped on self, nothing to do
  if (oldIndex === newIndex) return;
  
  // Compute new order
  const newOrder = arrayMove(taskIds, oldIndex, newIndex);
  
  // Persist to database
  await reorderTasks(section, newOrder);
  return;
}
```

### 3. Update Page Components

**Files:** 
- `src/app/(gtd)/inbox/page.tsx`
- `src/app/(gtd)/next/page.tsx`
- `src/app/(gtd)/waiting/page.tsx`
- `src/app/(gtd)/someday/page.tsx`
- `src/app/(gtd)/scheduled/page.tsx` (use regular TaskList - reordering disabled)

**Pattern for each page:**

```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";

export default async function InboxPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("INBOX"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Inbox</h1>
      <TaskListWithProvider
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="INBOX"
      />
    </div>
  );
}
```

**Notes:** 
- Pages do NOT wrap in TasksProvider - that happens once at the layout level (see section 5).
- For the Scheduled page specifically, use the regular `TaskList` component instead of `TaskListWithProvider` since reordering is disabled for date-ordered tasks. The tasks don't need to be in context if they can't be reordered.

### 4. Create TaskListWithProvider wrapper

**File:** `src/components/gtd/task-list-with-provider.tsx` (new)

A client component wrapper that calls `setTasks` on mount to populate the context.

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

### 5. Wrap Layout Children

**File:** `src/app/(gtd)/layout.tsx`

Wrap the layout's children in TasksProvider so context is available throughout the app.

```typescript
import { TasksProvider } from "@/contexts/tasks-context";

export default async function GtdLayout({ children }: { children: React.ReactNode }) {
  // ... existing code to fetch projects, counts, etc.

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
}
```

## Edge Cases & Error Handling

### Edge Cases

1. **Empty sections**
   - No other tasks to drop on, within-section reorder won't trigger
   - No changes needed

2. **Drag cancellation** (drop outside valid target)
   - `over` is null, early return prevents action
   - @dnd-kit handles visual snap-back

3. **Concurrent modifications**
   - Accept "last write wins" behavior
   - Revalidation ensures fresh data on next render

4. **Dropping on self**
   - `oldIndex === newIndex` → early return, no server call

5. **Scheduled section**
   - Tasks ordered by `scheduledDate`, not `sortOrder`
   - Reordering should be disabled: early return when section is SCHEDULED

6. **Network failure**
   - No optimistic updates, task snaps back on failure
   - Server errors logged to console (existing behavior)

### Error Handling

- Follow existing patterns (no toast notifications)
- Let @dnd-kit handle visual feedback
- Server transaction failures logged by Prisma
- Silent failures acceptable (matches current behavior)

## Testing Plan

### Manual Testing

1. **Basic reordering**
   - Drag task from position 1 to position 3 in Inbox
   - Verify it stays in new position
   - Refresh page → verify persistence

2. **Multiple reorders**
   - Reorder 3+ tasks in sequence
   - Refresh → verify all positions correct

3. **Edge positions**
   - Drag to first position
   - Drag to last position

4. **Cross-section still works**
   - Drag from Inbox to Next Actions (sidebar drop)
   - Verify section move works
   - Verify within-section not broken

5. **Scheduled section**
   - Attempt to reorder tasks in Scheduled
   - Verify reordering is disabled

6. **Network verification**
   - Open DevTools → Network tab
   - Drag within section
   - Verify server action request appears and succeeds

### Automated Testing

- Manual testing sufficient for this bug fix
- Existing server actions have no tests
- Future: Consider integration tests for drag-and-drop flows

## Non-Goals

- Optimistic UI updates (out of scope)
- Undo/redo functionality
- Real-time collaboration / conflict resolution
- Animated transitions beyond @dnd-kit defaults
- Accessibility improvements (maintain current level)

## Success Criteria

1. Users can drag tasks to reorder them within Inbox, Next, Waiting, Someday, and Logbook sections
2. Order persists across page refreshes
3. Network tab shows reorderTasks requests for within-section drops
4. Cross-section moves continue to work as before
5. Scheduled section remains date-ordered (reordering disabled)
6. No console errors or visual glitches

## Rollout

- Single feature branch
- Full manual testing before merge
- No feature flag needed (bug fix)
- Deploy to production after merge

---

**Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>**
