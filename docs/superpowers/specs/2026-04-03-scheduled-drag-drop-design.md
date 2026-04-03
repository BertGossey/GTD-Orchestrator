# Scheduled Section Drag-and-Drop - Design Specification

**Date:** 2026-04-03  
**Status:** Approved  
**Feature:** Enable drag-and-drop reordering and date changes for scheduled tasks

## Problem Statement

The scheduled section currently does not support drag-and-drop operations. Users cannot:
- Reorder tasks within the same day
- Move tasks to a different day by dragging them

This is inconsistent with other sections (Inbox, Next, Waiting, Someday) which all support drag-and-drop reordering.

### Current Behavior
- Scheduled tasks are ordered by `scheduledDate` ASC only
- Drag handler explicitly skips SCHEDULED section (line 90-91 in gtd-layout-client.tsx)
- Tasks are grouped by date in the UI with colored date headers
- Each day group uses `TaskList` (not `TaskListWithProvider`)

### Desired Behavior
- **Within-day reordering:** Drag a task to reorder it within the same day, maintaining manual sort order
- **Cross-day moves:** Drag a task to another day, which updates its `scheduledDate` to that date
- **Visual feedback:** Show drop indicator line at insertion point
- **Time preservation:** Keep the time component of `scheduledDate` when reordering

## Solution Architecture

### Overview

Use a **composite ordering system** for scheduled tasks:
1. **Primary sort:** Date component of `scheduledDate` (determines which day)
2. **Secondary sort:** `sortOrder` field (determines position within day)
3. **Tiebreaker:** Time component of `scheduledDate` (preserves meaningful times)

**Query Strategy:**
```typescript
orderBy: [
  { scheduledDate: "asc" },  // Groups by date
  { sortOrder: "asc" },      // Manual order within day
]
```

The time component acts as an automatic tiebreaker when sortOrders are equal.

### Key Design Decisions

1. **sortOrder per day:** Each day has its own sortOrder sequence (0, 1, 2, 3...)
2. **Time preservation:** When reordering within a day, preserve the task's time component
3. **Date extraction:** Use JavaScript to extract date keys (YYYY-MM-DD) for grouping and comparison
4. **Drop zones:** Tasks can be dropped on other tasks or between them within a day

## Implementation Details

### 1. Database & Queries

**A. Update `getTasksBySection` Query**

File: `src/actions/tasks.ts`

```typescript
export async function getTasksBySection(section: TaskSection) {
  return db.task.findMany({
    where: { section },
    orderBy: section === "SCHEDULED"
      ? [
          { scheduledDate: "asc" },  // Primary: date + time
          { sortOrder: "asc" },      // Secondary: manual order
        ]
      : { sortOrder: "asc" },
    include: { project: true },
  });
}
```

**B. New Server Action: `reorderScheduledTasks`**

File: `src/actions/tasks.ts`

```typescript
/**
 * Reorder a scheduled task within the same day or move it to a different day.
 * Handles sortOrder updates for all affected tasks.
 */
export async function reorderScheduledTasks(
  taskId: string,
  targetDateKey: string,     // Format: "YYYY-MM-DD"
  newIndex: number,           // Target position (0-based index)
  sameDayMove: boolean       // true = within-day reorder, false = cross-day move
) {
  // Fetch the task being moved
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { scheduledDate: true, sortOrder: true }
  });

  // Parse target date
  const [year, month, day] = targetDateKey.split('-').map(Number);
  
  // Preserve time component if same-day move
  let newDate: Date;
  if (sameDayMove && task.scheduledDate) {
    const hours = task.scheduledDate.getHours();
    const minutes = task.scheduledDate.getMinutes();
    const seconds = task.scheduledDate.getSeconds();
    newDate = new Date(year, month - 1, day, hours, minutes, seconds);
  } else {
    // Cross-day move: preserve time or use midnight
    const hours = task.scheduledDate?.getHours() ?? 0;
    const minutes = task.scheduledDate?.getMinutes() ?? 0;
    const seconds = task.scheduledDate?.getSeconds() ?? 0;
    newDate = new Date(year, month - 1, day, hours, minutes, seconds);
  }

  // Get all tasks for the target day
  const targetDayStart = new Date(year, month - 1, day, 0, 0, 0);
  const targetDayEnd = new Date(year, month - 1, day, 23, 59, 59);
  
  const targetDayTasks = await db.task.findMany({
    where: {
      section: "SCHEDULED",
      scheduledDate: {
        gte: targetDayStart,
        lte: targetDayEnd,
      },
      id: { not: taskId }, // Exclude the task being moved
    },
    orderBy: [
      { sortOrder: "asc" },
      { scheduledDate: "asc" },
    ],
    select: { id: true, sortOrder: true },
  });

  // Compute new sortOrder for all tasks
  const updates: Array<{ id: string; sortOrder: number }> = [];
  
  // Insert the moved task at newIndex
  let currentIndex = 0;
  for (let i = 0; i < targetDayTasks.length + 1; i++) {
    if (i === newIndex) {
      // This is where the moved task goes
      updates.push({ id: taskId, sortOrder: i });
    } else {
      // Assign sortOrder to existing tasks
      if (currentIndex < targetDayTasks.length) {
        updates.push({
          id: targetDayTasks[currentIndex].id,
          sortOrder: i,
        });
        currentIndex++;
      }
    }
  }

  // If newIndex is beyond the end, append to end
  if (newIndex >= targetDayTasks.length) {
    updates.push({ id: taskId, sortOrder: targetDayTasks.length });
  }

  // Execute all updates in a transaction
  await db.$transaction([
    // Update the moved task's date and sortOrder
    db.task.update({
      where: { id: taskId },
      data: {
        scheduledDate: newDate,
        sortOrder: newIndex,
      },
    }),
    // Update sortOrder for other tasks in target day
    ...updates
      .filter(u => u.id !== taskId)
      .map(u =>
        db.task.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      ),
  ]);

  revalidatePath("/scheduled");
}
```

**C. Helper Function: Extract Date Key**

```typescript
/**
 * Extract YYYY-MM-DD date key from a Date object
 */
export function extractDateKey(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### 2. Component Updates

**A. Scheduled Page**

File: `src/app/(gtd)/scheduled/page.tsx`

Changes:
1. Import `TaskListWithProvider` instead of `TaskList`
2. Use `TaskListWithProvider` for each day group
3. Keep existing date grouping logic

```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";

// In the render:
<TaskListWithProvider
  tasks={dayTasks}
  projects={projectList}
  sectionId="SCHEDULED"
  droppableId={`SCHEDULED-${dateKey}`}
/>
```

**B. Task List**

File: `src/components/gtd/task-list.tsx`

Update droppable data to include `dateKey` for SCHEDULED section:

```typescript
const dateKey = sectionId === "SCHEDULED" && droppableId
  ? droppableId.replace("SCHEDULED-", "")
  : undefined;

const { setNodeRef } = useDroppable({
  id: droppableId ?? `list-${sectionId}`,
  data: {
    section: sectionId,
    sortableIds: tasks.map((t) => t.id),
    dateKey, // Add for SCHEDULED section
  },
});
```

**C. Task Row**

File: `src/components/gtd/task-row.tsx`

Update sortable data to include `dateKey` for SCHEDULED tasks:

```typescript
import { extractDateKey } from "@/actions/tasks";

const dateKey = task.section === "SCHEDULED" 
  ? extractDateKey(task.scheduledDate)
  : undefined;

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: task.id,
  data: {
    section: task.section,
    scheduledDate: task.scheduledDate,
    dateKey, // Add for SCHEDULED tasks
  },
});
```

**D. Drag Handler**

File: `src/components/gtd/gtd-layout-client.tsx`

Remove SCHEDULED skip (lines 90-91) and add new logic:

```typescript
// Remove this:
// if (section === "SCHEDULED") return;

// Add after cross-section drop logic:

// SCHEDULED section handling
if (activeData?.section === "SCHEDULED" && overData?.section === "SCHEDULED") {
  const activeDateKey = activeData.dateKey;
  const overDateKey = overData.dateKey;
  
  if (!activeDateKey || !overDateKey) return;
  
  // Within-day reorder (same date)
  if (activeDateKey === overDateKey) {
    const dayTasks = tasks.filter(
      (t) => t.scheduledDate && extractDateKey(t.scheduledDate) === activeDateKey
    );
    const taskIds = dayTasks.map((t) => t.id);
    const oldIndex = taskIds.indexOf(active.id as string);
    const newIndex = taskIds.indexOf(over.id as string);
    
    if (oldIndex === -1 || newIndex === -1) return;
    if (oldIndex === newIndex) return;
    
    await reorderScheduledTasks(
      active.id as string,
      activeDateKey,
      newIndex,
      true // sameDayMove
    );
    return;
  }
  
  // Cross-day move (different dates)
  if (activeDateKey !== overDateKey) {
    const targetDayTasks = tasks.filter(
      (t) => t.scheduledDate && extractDateKey(t.scheduledDate) === overDateKey
    );
    const newIndex = targetDayTasks.findIndex((t) => t.id === over.id);
    const insertIndex = newIndex !== -1 ? newIndex : targetDayTasks.length;
    
    await reorderScheduledTasks(
      active.id as string,
      overDateKey,
      insertIndex,
      false // sameDayMove
    );
    return;
  }
}

// Keep existing within-section reorder logic for other sections
if (
  activeData?.section &&
  overData?.section &&
  activeData.section === overData.section &&
  activeData.section !== "SCHEDULED" // Explicitly exclude SCHEDULED
) {
  // ... existing logic ...
}
```

### 3. Visual Feedback

**Drop Indicator:**
- @dnd-kit automatically shows drop indicator line between tasks
- No custom styling needed for basic functionality

**Drag Cursor:**
- Standard @dnd-kit drag cursor (grab → grabbing)
- Valid drop zones highlight automatically

**Date Header:**
- Keep existing weekend/weekday coloring (green/red borders)
- No additional highlighting needed - date headers provide clear visual boundaries

### 4. Data Flow

**Within-Day Reorder:**
```
User drags task within same day
  ↓
handleDragEnd detects: activeDateKey === overDateKey
  ↓
Call reorderScheduledTasks(taskId, dateKey, newIndex, sameDayMove=true)
  ↓
Server preserves time, updates sortOrder for task + renumbers others in day
  ↓
revalidatePath("/scheduled")
  ↓
Page re-renders with new order
```

**Cross-Day Move:**
```
User drags task to different day
  ↓
handleDragEnd detects: activeDateKey !== overDateKey
  ↓
Call reorderScheduledTasks(taskId, targetDateKey, newIndex, sameDayMove=false)
  ↓
Server updates scheduledDate (preserving time) + assigns sortOrder in target day
  ↓
Renumber sortOrders in target day
  ↓
revalidatePath("/scheduled")
  ↓
Page re-renders, task appears in new day at correct position
```

## Edge Cases & Error Handling

### Edge Cases

1. **Tasks without time component**
   - Stored with time as midnight (00:00:00)
   - sortOrder determines position, time is tiebreaker
   - Preserved as-is when reordering

2. **Multiple tasks with same sortOrder**
   - Time component acts as tiebreaker in query
   - Renumbering ensures unique sortOrders after moves

3. **Dropping on same position**
   - Early return if oldIndex === newIndex
   - No database operation

4. **Empty day section**
   - Can still drop on day area (droppable container)
   - Task becomes first (and only) task with sortOrder 0

5. **Context not populated**
   - TaskListWithProvider populates context on mount
   - Handler reads from context (same as other sections)

6. **Tasks with null scheduledDate**
   - Filtered out by query (section = SCHEDULED requires scheduledDate)
   - Should never appear in scheduled section

### Error Handling

- **Failed reorder:** Task snaps back visually (no optimistic updates)
- **Invalid dateKey:** Server validates format, returns error if malformed
- **Missing task:** `findUniqueOrThrow` will throw if task doesn't exist
- **Transaction failure:** All updates rollback together
- **Concurrent updates:** Let Prisma/database handle conflicts

### Data Integrity

- Use `$transaction` for multi-task updates (atomic)
- sortOrder values remain contiguous (0, 1, 2, 3...)
- revalidatePath ensures UI reflects database state
- Time component preserved except when explicitly changed

## Testing Strategy

### Manual Testing

1. **Within-day reordering**
   - Create 3+ tasks on same day
   - Drag first task to middle position
   - Verify order persists after refresh
   - Check sortOrder values in database

2. **Cross-day move**
   - Drag task from Monday to Wednesday
   - Verify task appears in Wednesday group
   - Verify scheduledDate updated to Wednesday
   - Check time component preserved

3. **Time preservation**
   - Create task with specific time (e.g., 2:30 PM)
   - Reorder within same day
   - Verify time still shows 2:30 PM

4. **Edge positions**
   - Drag to first position in day
   - Drag to last position in day
   - Both should work correctly

5. **Empty day**
   - Drag task to day with no tasks
   - Verify task appears as only task in that day

6. **Cross-section moves**
   - Drag from Inbox to Scheduled (existing functionality)
   - Drag from Scheduled to Next (existing functionality)
   - Both should still work via moveTask action

### Automated Testing

Consider adding:
- Unit tests for `reorderScheduledTasks` server action
- Unit tests for `extractDateKey` helper
- Integration tests for drag-and-drop scenarios

## Non-Goals

- **Optimistic UI updates** - Tasks snap back on failure (consistent with other sections)
- **Time editing during drag** - Time is preserved, not edited
- **Visual day highlighting** - Drop indicator line is sufficient
- **Undo/redo** - Not in scope
- **Multi-select drag** - Single task only
- **Accessibility improvements** - Maintain current level

## Success Criteria

1. ✅ Users can reorder tasks within the same day by dragging
2. ✅ Order persists after page refresh
3. ✅ Users can drag tasks to different days
4. ✅ scheduledDate updates to target day when moved
5. ✅ Time component is preserved during reordering
6. ✅ sortOrder values are correct and contiguous
7. ✅ Visual drop indicator shows insertion point
8. ✅ Cross-section moves (to/from Scheduled) still work
9. ✅ No TypeScript errors
10. ✅ No console errors during drag operations

## Migration & Deployment

**No database migration needed** - sortOrder field already exists on Task model.

**Deployment steps:**
1. Deploy code changes
2. No data migration required
3. Existing scheduled tasks will have sortOrder values from when they were created
4. First drag operation will renumber tasks in affected day

**Backwards compatibility:**
- Existing tasks work as-is
- sortOrder values may be non-contiguous initially (fine - will be fixed on first reorder)
- Time components preserved

---

**Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>**
