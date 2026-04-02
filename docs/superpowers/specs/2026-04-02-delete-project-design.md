# Delete Project Functionality - Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Add the ability to delete projects from the GTD Orchestrator. When a project is deleted, associated tasks will lose their project association (projectId set to null) but remain in their current sections.

## Requirements

### Functional Requirements

1. Users can delete a project from the project detail page
2. Deletion requires confirmation via dialog
3. Tasks belonging to the deleted project have their projectId set to null
4. After deletion, user is redirected to home page
5. All project references are cleaned up (sidebar, etc.) via revalidation

### User Experience Requirements

1. Delete action is discoverable but not accidentally clickable
2. Confirmation dialog clearly states the consequence (tasks lose project association)
3. Deletion feels immediate and responsive

## Design Decisions

### Task Handling on Delete

**Decision:** Set task projectId to null

When a project is deleted, all tasks that reference it will have their `projectId` set to `null`. Tasks remain in their current sections (Next, Waiting, Scheduled, Someday, Logbook).

**Rationale:** Tasks represent work that still needs to be done. Deleting the project doesn't mean the work disappears. This approach preserves user work while removing the organizational structure.

**Database Behavior:** The Prisma schema already supports this - `projectId` is nullable and defaults to `SetNull` on delete.

### UI Pattern

**Decision:** Dropdown menu with actions

Add a dropdown menu (three-dot vertical icon) to the ProjectHeader component. The menu initially contains only "Delete project", but is structured to accommodate future actions (Archive, Duplicate, Export, etc.).

**Rationale:** 
- Scales well as features are added
- Familiar pattern to users
- Keeps header clean and uncluttered
- Prevents accidental deletion (requires two clicks: menu open + delete)

### Confirmation

**Decision:** Simple confirmation dialog

Show an AlertDialog with:
- Title: "Delete project?"
- Message: "Are you sure? Tasks in this project will lose their project association."
- Actions: "Cancel" (default) and "Delete" (destructive)

**Rationale:** Adequate protection against accidental deletion without being overly burdensome. User can clearly see the consequence (task disassociation) before confirming.

## Architecture

### Server Action

**File:** `src/actions/projects.ts`

Add new server action:

```typescript
export async function deleteProject(id: string) {
  await db.project.delete({
    where: { id },
  });
  
  revalidatePath("/", "layout");
  return { success: true };
}
```

**Behavior:**
- Deletes project from database
- Database automatically sets task.projectId to null (Prisma default SetNull behavior)
- Revalidates entire layout to update sidebar and any cached project lists

### Component Changes

**File:** `src/components/gtd/project-header.tsx`

**Additions:**
1. Import `deleteProject` action and `useRouter` hook
2. Add state for AlertDialog visibility
3. Add DropdownMenu with three-dot icon trigger
4. Add AlertDialog for confirmation
5. Handle delete: call action in transition, redirect on success

**Layout:**
- Dropdown trigger positioned in top-right of project header area
- Menu contains "Delete project" in destructive (red) styling
- AlertDialog centered modal with backdrop

### UI Components

**Required shadcn Components:**
- DropdownMenu (may need installation)
- AlertDialog (may need installation)
- MoreVertical icon from lucide-react

### Navigation Flow

1. User clicks three-dot menu icon → Dropdown opens
2. User clicks "Delete project" → AlertDialog appears
3. User clicks "Delete" → Server action called
4. On success → Redirect to `/` (home page)
5. Layout revalidation → Sidebar updates, project removed from lists

## Error Handling

**Database errors:** If deletion fails, the error propagates to the client. The transition state handles loading feedback.

**Network failures:** React's useTransition provides pending state. If network fails, user sees loading state until timeout/retry.

**Validation:** No validation needed - any authenticated user should be able to delete projects they can view.

## Testing Considerations

**Manual Testing:**
1. Delete project with no tasks → Success, redirect to home
2. Delete project with tasks → Success, tasks visible in sections without project tag
3. Cancel deletion → Dialog closes, no changes
4. Network failure during delete → Error handling, retry capability

**Edge Cases:**
- Deleting project while viewing it (handled by redirect)
- Multiple quick deletes (transition prevents double-submit)
- Project already deleted by another session (database error, acceptable)

## Future Extensibility

The dropdown menu pattern allows easy addition of more project actions:
- Archive project (set status to INACTIVE)
- Duplicate project
- Export project tasks
- Project settings
- Share project

Each new action is added as a menu item without changing the UI structure.
