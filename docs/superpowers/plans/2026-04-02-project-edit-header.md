# Project Edit Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline editing for project title and description on the project detail page.

**Architecture:** A new `ProjectHeader` client component holds editable `useState` for title and description, saves on blur via the existing `updateProject` server action, and replaces the read-only `<h1>` / `<p>` block at the top of the project detail page. The page itself remains a Server Component.

**Tech Stack:** Next.js 15 App Router, React `useState` / `useTransition`, `updateProject` server action, shadcn/ui `Input`, Tailwind CSS, Vitest

---

### Task 1: Create `ProjectHeader` client component

**Files:**
- Create: `src/components/gtd/project-header.tsx`

No unit test file is needed for this task: the project has no React component testing infrastructure (`vitest.config.ts` only includes `*.test.ts`, not `*.test.tsx`), and the `updateProject` server action it calls is already fully tested in `src/actions/projects.test.ts`. TypeScript is the quality gate here.

- [ ] **Step 1: Create `src/components/gtd/project-header.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { updateProject } from "@/actions/projects";

export function ProjectHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const [titleValue, setTitleValue] = useState(title);
  const [descriptionValue, setDescriptionValue] = useState(description);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateProject(id, {
        title: titleValue.trim() || title,
        description: descriptionValue.trim() || null,
      });
    });
  }

  return (
    <div className="mb-4">
      <Input
        value={titleValue}
        onChange={(e) => setTitleValue(e.target.value)}
        onBlur={() => save()}
        className="mb-1 border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-input focus-visible:bg-background focus-visible:px-3 transition-all"
      />
      <textarea
        value={descriptionValue}
        onChange={(e) => setDescriptionValue(e.target.value)}
        onBlur={() => save()}
        placeholder="Add a description..."
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {isPending && (
        <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
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

- [ ] **Step 3: Commit**

```bash
git add src/components/gtd/project-header.tsx
git commit -m "feat: add ProjectHeader client component for inline editing"
```

---

### Task 2: Wire `ProjectHeader` into the project detail page

**Files:**
- Modify: `src/app/(gtd)/projects/[id]/page.tsx`

- [ ] **Step 1: Replace the read-only title/description block with `<ProjectHeader>`**

Open `src/app/(gtd)/projects/[id]/page.tsx`. Make two changes:

**Add the import** at the top (after the existing imports):

```tsx
import { ProjectHeader } from "@/components/gtd/project-header";
```

**Replace** this block (lines 46–51):

```tsx
      <h1 className="mb-1 text-xl font-semibold">{project.title}</h1>
      {project.description && (
        <p className="mb-4 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}
```

With:

```tsx
      <ProjectHeader
        id={project.id}
        title={project.title}
        description={project.description ?? ""}
      />
```

The `<Separator className="mb-6" />` line immediately after remains unchanged.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npx vitest run
```

Expected: all 43 tests pass.

- [ ] **Step 4: Smoke test in the browser**

Start the dev server (`npm run dev`) and navigate to any project at `http://localhost:3003/projects/<id>`. Confirm:
- The project title appears as an editable input field styled like a heading (no visible border at rest, border appears on focus).
- The description appears as an editable textarea below it with a placeholder "Add a description..." when empty.
- Editing the title and clicking away (blur) saves the change — navigate away and back to confirm persistence.
- Editing the description and clicking away saves the change.
- Clearing the title and blurring does NOT save an empty title (the previous title is preserved).
- The "Saving..." indicator appears briefly during save.

- [ ] **Step 5: Commit**

```bash
git add src/app/(gtd)/projects/[id]/page.tsx
git commit -m "feat: replace read-only project header with inline editable ProjectHeader"
```
