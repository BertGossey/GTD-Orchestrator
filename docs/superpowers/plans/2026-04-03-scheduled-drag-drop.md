# Scheduled Section Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable drag-and-drop reordering within same day and moving tasks to different days in scheduled section

**Architecture:** Use composite ordering (date + sortOrder + time) for scheduled tasks, detect within-day vs cross-day drops in drag handler, update server action to handle both scenarios while preserving time components

**Tech Stack:** Next.js 15, TypeScript, Prisma, @dnd-kit, React

---

## File Structure

**Modified files:**
- `src/actions/tasks.ts` - Add `extractDateKey` helper, `reorderScheduledTasks` server action, update `getTasksBySection` query
- `src/actions/tasks.test.ts` - Add tests for new functions
- `src/app/(gtd)/scheduled/page.tsx` - Switch from `TaskList` to `TaskListWithProvider`
- `src/components/gtd/task-list.tsx` - Add `dateKey` to droppable data for SCHEDULED section
- `src/components/gtd/task-row.tsx` - Add `dateKey` to sortable data for SCHEDULED tasks
- `src/components/gtd/gtd-layout-client.tsx` - Remove SCHEDULED skip, add within-day and cross-day reorder logic

**No new files created** - all changes are modifications to existing files.

---

### Task 1: Add extractDateKey helper function

**Files:**
- Modify: `src/actions/tasks.ts`
- Test: `src/actions/tasks.test.ts`

- [ ] **Step 1: Write failing test for extractDateKey**

```typescript
// Add to src/actions/tasks.test.ts
describe("extractDateKey", () => {
  it("should extract YYYY-MM-DD from Date object", () => {
    const date = new Date(2026, 3, 15, 14, 30, 0); // April 15, 2026, 2:30 PM
    expect(extractDateKey(date)).toBe("2026-04-15");
  });

  it("should pad single-digit months and days with zero", () => {
    const date = new Date(2026, 0, 5, 9, 0, 0); // January 5, 2026
    expect(extractDateKey(date)).toBe("2026-01-05");
  });

  it("should return null for null input", () => {
    expect(extractDateKey(null)).toBeNull();
  });

  it("should preserve date regardless of time", () => {
    const midnight = new Date(2026, 3, 15, 0, 0, 0);
    const noon = new Date(2026, 3, 15, 12, 0, 0);
    const evening = new Date(2026, 3, 15, 23, 59, 59);
    
    expect(extractDateKey(midnight)).toBe("2026-04-15");
    expect(extractDateKey(noon)).toBe("2026-04-15");
    expect(extractDateKey(evening)).toBe("2026-04-15");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tasks.test.ts`
Expected: FAIL with "extractDateKey is not defined"

- [ ] **Step 3: Implement extractDateKey function**

```typescript
// Add to src/actions/tasks.ts after existing exports

/**
 * Extract YYYY-MM-DD date key from a Date object.
 * Used for grouping and comparing scheduled tasks by date.
 */
export function extractDateKey(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tasks.test.ts`
Expected: All tests pass (4 new tests)

- [ ] **Step 5: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: add extractDateKey helper for scheduled tasks"
```

---

### Task 2: Update getTasksBySection for composite ordering

**Files:**
- Modify: `src/actions/tasks.ts:147-155`
- Test: `src/actions/tasks.test.ts`

- [ ] **Step 1: Write test for SCHEDULED section ordering**

```typescript
// Add to src/actions/tasks.test.ts
describe("getTasksBySection with SCHEDULED ordering", () => {
  beforeEach(async () => {
    // Clear existing tasks
    await db.task.deleteMany({});
  });

  it("should order SCHEDULED tasks by date then sortOrder", async () => {
    // Create tasks on different days with different sortOrders
    const task1 = await db.task.create({
      data: {
        rawInput: "Task 1",
        title: "Task 1",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 10, 0, 0), // April 15, 10 AM
        sortOrder: 1,
      },
    });
    const task2 = await db.task.create({
      data: {
        rawInput: "Task 2",
        title: "Task 2",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 14, 0, 0), // April 15, 2 PM
        sortOrder: 0,
      },
    });
    const task3 = await db.task.create({
      data: {
        rawInput: "Task 3",
        title: "Task 3",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 16, 9, 0, 0), // April 16, 9 AM
        sortOrder: 0,
      },
    });

    const tasks = await getTasksBySection("SCHEDULED");

    // Should be ordered: task2 (Apr 15, sortOrder 0), task1 (Apr 15, sortOrder 1), task3 (Apr 16)
    expect(tasks[0].id).toBe(task2.id);
    expect(tasks[1].id).toBe(task1.id);
    expect(tasks[2].id).toBe(task3.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tasks.test.ts`
Expected: FAIL - tasks ordered by date only, not sortOrder

- [ ] **Step 3: Update getTasksBySection query**

```typescript
// Update src/actions/tasks.ts around line 147
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tasks.test.ts`
Expected: Test passes

- [ ] **Step 5: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: update SCHEDULED query to use composite ordering"
```

---

### Task 3: Add reorderScheduledTasks server action

**Files:**
- Modify: `src/actions/tasks.ts`
- Test: `src/actions/tasks.test.ts`

- [ ] **Step 1: Write failing test for reorderScheduledTasks**

```typescript
// Add to src/actions/tasks.test.ts
describe("reorderScheduledTasks", () => {
  beforeEach(async () => {
    await db.task.deleteMany({});
  });

  it("should reorder tasks within same day", async () => {
    // Create 3 tasks on same day
    const task1 = await db.task.create({
      data: {
        rawInput: "Task 1",
        title: "Task 1",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 10, 0, 0),
        sortOrder: 0,
      },
    });
    const task2 = await db.task.create({
      data: {
        rawInput: "Task 2",
        title: "Task 2",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 11, 0, 0),
        sortOrder: 1,
      },
    });
    const task3 = await db.task.create({
      data: {
        rawInput: "Task 3",
        title: "Task 3",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 12, 0, 0),
        sortOrder: 2,
      },
    });

    // Move task1 to position 2 (after task2, before task3)
    await reorderScheduledTasks(task1.id, "2026-04-15", 2, true);

    const tasks = await getTasksBySection("SCHEDULED");
    expect(tasks[0].id).toBe(task2.id);
    expect(tasks[0].sortOrder).toBe(0);
    expect(tasks[1].id).toBe(task3.id);
    expect(tasks[1].sortOrder).toBe(1);
    expect(tasks[2].id).toBe(task1.id);
    expect(tasks[2].sortOrder).toBe(2);
    
    // Time should be preserved
    expect(tasks[2].scheduledDate?.getHours()).toBe(10);
  });

  it("should move task to different day", async () => {
    const task = await db.task.create({
      data: {
        rawInput: "Task",
        title: "Task",
        section: "SCHEDULED",
        scheduledDate: new Date(2026, 3, 15, 14, 30, 0), // April 15, 2:30 PM
        sortOrder: 0,
      },
    });

    // Move to April 16
    await reorderScheduledTasks(task.id, "2026-04-16", 0, false);

    const updated = await db.task.findUnique({ where: { id: task.id } });
    expect(updated?.scheduledDate?.getDate()).toBe(16);
    expect(updated?.scheduledDate?.getMonth()).toBe(3); // April
    expect(updated?.scheduledDate?.getHours()).toBe(14);
    expect(updated?.scheduledDate?.getMinutes()).toBe(30);
    expect(updated?.sortOrder).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test tasks.test.ts`
Expected: FAIL with "reorderScheduledTasks is not defined"

- [ ] **Step 3: Implement reorderScheduledTasks function**

```typescript
// Add to src/actions/tasks.ts after reorderTasks function

/**
 * Reorder a scheduled task within the same day or move it to a different day.
 * Handles sortOrder updates for all affected tasks.
 * 
 * @param taskId - ID of task to reorder
 * @param targetDateKey - Target date in YYYY-MM-DD format
 * @param newIndex - Target position (0-based index)
 * @param sameDayMove - true = within-day reorder, false = cross-day move
 */
export async function reorderScheduledTasks(
  taskId: string,
  targetDateKey: string,
  newIndex: number,
  sameDayMove: boolean
) {
  // Fetch the task being moved
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { scheduledDate: true, sortOrder: true },
  });

  // Parse target date
  const [year, month, day] = targetDateKey.split("-").map(Number);

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

  // Get all tasks for the target day (excluding the task being moved)
  const targetDayStart = new Date(year, month - 1, day, 0, 0, 0);
  const targetDayEnd = new Date(year, month - 1, day, 23, 59, 59);

  const targetDayTasks = await db.task.findMany({
    where: {
      section: "SCHEDULED",
      scheduledDate: {
        gte: targetDayStart,
        lte: targetDayEnd,
      },
      id: { not: taskId },
    },
    orderBy: [{ sortOrder: "asc" }, { scheduledDate: "asc" }],
    select: { id: true, sortOrder: true },
  });

  // Compute new sortOrder for all tasks
  const updates: Array<{ id: string; sortOrder: number }> = [];

  // Insert the moved task at newIndex
  let currentIndex = 0;
  for (let i = 0; i <= targetDayTasks.length; i++) {
    if (i === newIndex) {
      // Skip - the moved task will be updated separately
      continue;
    } else if (currentIndex < targetDayTasks.length) {
      updates.push({
        id: targetDayTasks[currentIndex].id,
        sortOrder: i < newIndex ? i : i - 1,
      });
      currentIndex++;
    }
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
    ...updates.map((u) =>
      db.task.update({
        where: { id: u.id },
        data: { sortOrder: u.sortOrder },
      })
    ),
  ]);

  revalidatePath("/scheduled");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test tasks.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: add reorderScheduledTasks server action"
```

---

### Task 4: Update scheduled page to use TaskListWithProvider

**Files:**
- Modify: `src/app/(gtd)/scheduled/page.tsx:1-86`

- [ ] **Step 1: Update import statement**

Change line 3 from:
```typescript
import { TaskList } from "@/components/gtd/task-list";
```

To:
```typescript
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";
```

- [ ] **Step 2: Update component usage**

Change line 73 from:
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
git add src/app/\(gtd\)/scheduled/page.tsx
git commit -m "feat: update scheduled page to use TaskListWithProvider"
```

---

### Task 5: Update TaskList to include dateKey for SCHEDULED

**Files:**
- Modify: `src/components/gtd/task-list.tsx:1-47`

- [ ] **Step 1: Import extractDateKey helper**

Add to imports at top of file (after line 8):
```typescript
import { extractDateKey } from "@/actions/tasks";
```

- [ ] **Step 2: Extract dateKey from droppableId**

Add after line 20 (inside component, before useDroppable):
```typescript
// Extract dateKey for SCHEDULED section
const dateKey =
  sectionId === "SCHEDULED" && droppableId
    ? droppableId.replace("SCHEDULED-", "")
    : undefined;
```

- [ ] **Step 3: Add dateKey to droppable data**

Update the useDroppable call (around line 22-27) to include dateKey:
```typescript
const { setNodeRef } = useDroppable({
  id: droppableId ?? `list-${sectionId}`,
  data: {
    section: sectionId,
    sortableIds: tasks.map((t) => t.id),
    dateKey,
  },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/gtd/task-list.tsx
git commit -m "feat: add dateKey to TaskList droppable data for SCHEDULED"
```

---

### Task 6: Update TaskRow to include dateKey for SCHEDULED

**Files:**
- Modify: `src/components/gtd/task-row.tsx:1-119`

- [ ] **Step 1: Import extractDateKey helper**

Add to imports at top of file (after line 12):
```typescript
import { extractDateKey } from "@/actions/tasks";
```

- [ ] **Step 2: Compute dateKey for SCHEDULED tasks**

Add after line 24 (inside component, before useSortable):
```typescript
const dateKey =
  task.section === "SCHEDULED" ? extractDateKey(task.scheduledDate) : undefined;
```

- [ ] **Step 3: Add dateKey to sortable data**

Update the useSortable call (around line 33-38) to include dateKey:
```typescript
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
    dateKey,
  },
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/gtd/task-row.tsx
git commit -m "feat: add dateKey to TaskRow sortable data for SCHEDULED"
```

---

### Task 7: Update drag handler to support SCHEDULED reordering

**Files:**
- Modify: `src/components/gtd/gtd-layout-client.tsx:1-145`

- [ ] **Step 1: Import extractDateKey and reorderScheduledTasks**

Add to imports at top of file (after line 16):
```typescript
import { moveTask, reorderTasks, reorderScheduledTasks, extractDateKey } from "@/actions/tasks";
```

- [ ] **Step 2: Remove SCHEDULED skip logic**

Delete lines 90-91:
```typescript
// Skip reordering for SCHEDULED section (ordered by date, not sortOrder)
if (section === "SCHEDULED") return;
```

- [ ] **Step 3: Add SCHEDULED handling before existing within-section logic**

Add after the cross-section drop block (after line 68, before the existing within-section block at line 82):

```typescript
// SCHEDULED section handling - within-day and cross-day
if (
  activeData?.section === "SCHEDULED" &&
  overData?.section === "SCHEDULED"
) {
  const activeDateKey = activeData.dateKey;
  const overDateKey = overData.dateKey;

  if (!activeDateKey || !overDateKey) return;

  // Within-day reorder (same date)
  if (activeDateKey === overDateKey) {
    const dayTasks = tasks.filter(
      (t) =>
        t.scheduledDate && extractDateKey(t.scheduledDate) === activeDateKey
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
      (t) =>
        t.scheduledDate && extractDateKey(t.scheduledDate) === overDateKey
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
```

- [ ] **Step 4: Update existing within-section logic to exclude SCHEDULED**

Update the existing within-section reorder block (around line 82-112) to explicitly exclude SCHEDULED:

Change line 82-86 from:
```typescript
// Within-section reorder
if (
  activeData?.section &&
  overData?.section &&
  activeData.section === overData.section
) {
```

To:
```typescript
// Within-section reorder (non-SCHEDULED sections)
if (
  activeData?.section &&
  overData?.section &&
  activeData.section === overData.section &&
  activeData.section !== "SCHEDULED"
) {
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/gtd/gtd-layout-client.tsx
git commit -m "feat: add SCHEDULED drag-drop support to drag handler"
```

---

### Task 8: Manual testing - within-day reordering

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3003

- [ ] **Step 2: Create test tasks in scheduled section**

1. Navigate to http://localhost:3003/scheduled
2. Create 3+ tasks on the same day using rapid entry:
   - "Task A @scheduled 2026-04-10"
   - "Task B @scheduled 2026-04-10"
   - "Task C @scheduled 2026-04-10"

- [ ] **Step 3: Test basic within-day reordering**

1. Drag Task A and drop it between Task B and Task C
2. Observe: Task moves to new position
3. Open DevTools → Network tab
4. Drag Task C to first position
5. Verify: Network request appears (reorderScheduledTasks)

- [ ] **Step 4: Test persistence**

1. Refresh page (F5)
2. Verify: Tasks remain in reordered positions

- [ ] **Step 5: Verify sortOrder in database**

Run in console or database tool:
```sql
SELECT id, title, section, scheduledDate, sortOrder 
FROM Task 
WHERE section = 'SCHEDULED' 
ORDER BY scheduledDate, sortOrder;
```

Expected: sortOrder values are 0, 1, 2 for tasks on same day

- [ ] **Step 6: Document results**

If all tests pass, continue. If any fail, note the failure and debug.

---

### Task 9: Manual testing - cross-day moves

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Create tasks on multiple days**

1. Open http://localhost:3003/scheduled
2. Create tasks on different days:
   - "Monday task @scheduled 2026-04-13"
   - "Wednesday task 1 @scheduled 2026-04-15"
   - "Wednesday task 2 @scheduled 2026-04-15"

- [ ] **Step 2: Test cross-day move**

1. Drag "Monday task" and drop it on "Wednesday task 2"
2. Verify: Task moves to Wednesday group
3. Check Network tab: reorderScheduledTasks request appears

- [ ] **Step 3: Verify date changed**

1. Click on the moved task to expand details
2. Verify: Scheduled date shows Wednesday (2026-04-15)

- [ ] **Step 4: Test time preservation**

1. Edit a task to have a specific time (e.g., 2:30 PM)
2. Drag it to another day
3. Verify: Time component (2:30 PM) is preserved on new day

- [ ] **Step 5: Test persistence**

1. Refresh page
2. Verify: Task remains on new day in correct position

- [ ] **Step 6: Document results**

If all tests pass, continue. If any fail, debug and document.

---

### Task 10: Manual testing - edge cases

**Files:**
- Test: Browser manual testing

- [ ] **Step 1: Test dropping on same position**

1. Drag a task and drop it on itself
2. Verify: No network request, no visual change

- [ ] **Step 2: Test empty day**

1. Create a new task for a day with no existing tasks
2. Verify: Task appears as first (and only) task on that day

- [ ] **Step 3: Test reordering to first/last position**

1. Drag last task to first position
2. Verify: Task moves to top
3. Drag first task to last position
4. Verify: Task moves to bottom

- [ ] **Step 4: Test cross-section moves still work**

1. Drag task from Inbox to Scheduled section (sidebar drop)
2. Verify: ScheduledDateDialog appears
3. Select a date and confirm
4. Verify: Task moves to Scheduled with correct date

- [ ] **Step 5: Test time component edge cases**

1. Create task with no time (midnight)
2. Reorder within same day
3. Verify: Time stays at midnight
4. Create task with specific time (3:45 PM)
5. Reorder within same day
6. Verify: Time stays at 3:45 PM

- [ ] **Step 6: Document results**

Note any issues found. All edge cases should work correctly.

---

### Task 11: Final verification

**Files:**
- Test: All files

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No errors or only minor warnings

- [ ] **Step 4: Review git status**

Run: `git status`
Expected: All changes committed, working tree clean

- [ ] **Step 5: Review commit log**

Run: `git log --oneline -10`
Expected: See all 7 feature commits from this implementation

- [ ] **Step 6: Create summary document**

Summary:
- **What was added:** Scheduled section now supports drag-and-drop reordering within same day and moving tasks to different days
- **How it works:** Composite ordering (date + sortOrder + time), drag handler detects within-day vs cross-day, server action preserves time while updating date/sortOrder
- **How to verify:** 
  1. Drag tasks within same day - order persists
  2. Drag tasks to different day - date updates, time preserved
  3. Refresh page - all changes persist
  4. Check database - sortOrder values are correct (0, 1, 2...)

---

## Success Criteria

✓ Within-day reordering works and persists  
✓ Cross-day moves work and update scheduledDate  
✓ Time component preserved during reordering  
✓ sortOrder values are correct and contiguous  
✓ Drop indicator shows insertion point  
✓ Cross-section moves (to/from Scheduled) still work  
✓ All tests pass  
✓ No TypeScript errors  
✓ No console errors during drag operations

---

**Implementation complete!** All tasks checked off = feature is ready for code review and merge.
