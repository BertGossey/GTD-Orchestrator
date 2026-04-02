# Delete Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project deletion functionality with dropdown menu, confirmation dialog, and redirect.

**Architecture:** Add deleteProject server action, install AlertDialog component, enhance ProjectHeader with dropdown menu and delete confirmation flow.

**Tech Stack:** Next.js Server Actions, shadcn/ui (DropdownMenu, AlertDialog), React hooks (useTransition, useRouter, useState)

---

## File Structure

**Files to modify:**
- `src/actions/projects.ts` - Add deleteProject server action
- `src/components/gtd/project-header.tsx` - Add dropdown menu, alert dialog, delete logic

**Files to create:**
- `src/components/ui/alert-dialog.tsx` - Install shadcn AlertDialog component

---

## Task 1: Install AlertDialog Component

**Files:**
- Create: `src/components/ui/alert-dialog.tsx`

- [ ] **Step 1: Install shadcn alert-dialog component**

Run:
```bash
npx shadcn@latest add alert-dialog
```

Expected: Component installed to `src/components/ui/alert-dialog.tsx`

- [ ] **Step 2: Verify component installation**

Run:
```bash
ls src/components/ui/alert-dialog.tsx
```

Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/alert-dialog.tsx
git commit -m "chore: add alert-dialog shadcn component"
```

---

## Task 2: Add deleteProject Server Action

**Files:**
- Modify: `src/actions/projects.ts`

- [ ] **Step 1: Add deleteProject function to projects.ts**

Add this function after the `getProjectWithTasks` function:

```typescript
export async function deleteProject(id: string) {
  await db.project.delete({
    where: { id },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/actions/projects.ts
git commit -m "feat: add deleteProject server action"
```

---

## Task 3: Add Dropdown Menu and Delete Dialog to ProjectHeader

**Files:**
- Modify: `src/components/gtd/project-header.tsx`

- [ ] **Step 1: Add imports to project-header.tsx**

At the top of the file, update imports:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateProject, deleteProject } from "@/actions/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Add state for AlertDialog**

Inside the ProjectHeader function, after the existing useState declarations, add:

```typescript
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const router = useRouter();
```

- [ ] **Step 3: Add handleDelete function**

Add this function before the `return` statement:

```typescript
function handleDelete() {
  startTransition(async () => {
    await deleteProject(id);
    router.push("/");
  });
}
```

- [ ] **Step 4: Update the return JSX to include dropdown and dialog**

Replace the existing return statement with:

```typescript
return (
  <div className="mb-4">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <Input
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={() => save()}
          className="mb-1 border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-input focus-visible:bg-background focus-visible:px-3 transition-all"
        />
        {editingDescription ? (
          <textarea
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={() => {
              setEditingDescription(false);
              save();
            }}
            autoFocus
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <p
            onClick={() => setEditingDescription(true)}
            className="cursor-text text-sm text-muted-foreground"
          >
            {descriptionValue || (
              <span className="italic">Add a description...</span>
            )}
          </p>
        )}
        {isPending && (
          <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete project?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure? Tasks in this project will lose their project
            association.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
```

- [ ] **Step 5: Verify TypeScript compilation**

Run:
```bash
npm run typecheck
```

Expected: No errors

- [ ] **Step 6: Verify Button component exists**

Run:
```bash
ls src/components/ui/button.tsx
```

Expected: File exists (if not, run `npx shadcn@latest add button`)

- [ ] **Step 7: Start dev server and test manually**

Run:
```bash
npm run dev
```

Expected: Server starts on localhost:3003

- [ ] **Step 8: Manual test - Open project page**

Navigate to: `http://localhost:3003/projects/<any-project-id>`

Expected: 
- Three-dot menu icon appears in top-right of project header
- Click opens dropdown with "Delete project" in red text

- [ ] **Step 9: Manual test - Cancel deletion**

1. Click three-dot menu
2. Click "Delete project"
3. Click "Cancel" in dialog

Expected: Dialog closes, project still exists

- [ ] **Step 10: Manual test - Confirm deletion**

1. Click three-dot menu
2. Click "Delete project"
3. Click "Delete" in dialog

Expected:
- Redirected to home page (`/`)
- Project removed from sidebar
- Project no longer accessible

- [ ] **Step 11: Manual test - Delete project with tasks**

1. Create a project with some tasks
2. Delete the project
3. Check tasks in their sections (Next, Waiting, etc.)

Expected: Tasks still exist but show no project association

- [ ] **Step 12: Stop dev server**

Press `Ctrl+C` in terminal

- [ ] **Step 13: Commit**

```bash
git add src/components/gtd/project-header.tsx
git commit -m "feat: add dropdown menu and delete confirmation to project header

- Add three-dot menu with delete option
- Add AlertDialog for deletion confirmation
- Implement delete action with redirect to home
- Tasks retain data but lose project association on delete

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Push Changes

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

- [x] AlertDialog component installed
- [x] deleteProject server action added
- [x] ProjectHeader has dropdown menu
- [x] Delete confirmation dialog works
- [x] Deletion redirects to home
- [x] Project removed from sidebar after delete
- [x] Tasks lose project association but remain in sections
- [x] Manual testing completed
- [x] All changes committed and pushed
