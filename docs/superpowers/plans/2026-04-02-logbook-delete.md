# Logbook Delete Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent delete button to each logbook row that immediately removes the task from the database.

**Architecture:** A new `deleteTask` server action handles the database deletion and cache revalidation. The logbook page wraps each row's trash button in a `<form>` that posts to the bound action — no client component needed.

**Tech Stack:** Next.js Server Actions, Prisma, Vitest, Tailwind CSS, lucide-react

---

### Task 1: Add `deleteTask` server action

**Files:**
- Modify: `src/actions/tasks.ts`
- Modify: `src/actions/tasks.test.ts`

- [ ] **Step 1: Add `delete` to the db mock in the test file**

In `src/actions/tasks.test.ts`, find the `vi.mock("@/lib/db", ...)` block at the top. Add `delete: vi.fn()` to `db.task`:

```ts
vi.mock("@/lib/db", () => ({
  db: {
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));
```

Also add `deleteTask` to the import from `"./tasks"`:

```ts
import {
  createTask,
  updateTask,
  moveTask,
  reorderTasks,
  completeTask,
  getTasksBySection,
  getInboxCount,
  deleteTask,
} from "./tasks";
```

- [ ] **Step 2: Write the failing tests**

Append this `describe` block at the end of `src/actions/tasks.test.ts`:

```ts
describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the task by id", async () => {
    vi.mocked(db.task.delete).mockResolvedValue({ id: "1" } as never);

    await deleteTask("1");

    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("calls revalidatePath on /logbook", async () => {
    vi.mocked(db.task.delete).mockResolvedValue({ id: "1" } as never);

    await deleteTask("1");

    expect(revalidatePath).toHaveBeenCalledWith("/logbook");
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/actions/tasks.test.ts
```

Expected: FAIL — `deleteTask` is not exported from `./tasks`.

- [ ] **Step 4: Implement `deleteTask` in `src/actions/tasks.ts`**

Add this function at the end of the file (before the closing, after `getInboxCount`):

```ts
export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
  revalidatePath("/logbook");
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/actions/tasks.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: add deleteTask server action"
```

---

### Task 2: Add delete button to logbook page

**Files:**
- Modify: `src/app/(gtd)/logbook/page.tsx`

- [ ] **Step 1: Add the delete form to each task row**

Replace the full contents of `src/app/(gtd)/logbook/page.tsx` with:

```tsx
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { deleteTask } from "@/actions/tasks";

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
                <form action={deleteTask.bind(null, task.id)}>
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test in the browser**

Start the dev server (`npm run dev`) and navigate to `http://localhost:3003/logbook`. Confirm:
- Each completed task row shows a trash icon on the right.
- Clicking the trash icon removes the row immediately (page reloads via Server Action).

- [ ] **Step 4: Commit**

```bash
git add src/app/(gtd)/logbook/page.tsx
git commit -m "feat: add delete button to logbook rows"
```
