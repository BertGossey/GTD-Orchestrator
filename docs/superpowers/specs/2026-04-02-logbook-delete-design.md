# Logbook Delete Feature — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Summary

Add permanent delete functionality to the Logbook page. Each completed task row gets a trash icon button that immediately deletes the task from the database with no confirmation step.

## Architecture

No new components are introduced. Changes are confined to two existing files:

- `src/actions/tasks.ts` — new `deleteTask` server action
- `src/app/(gtd)/logbook/page.tsx` — add delete button to each row

The logbook page remains a pure Server Component. The delete is triggered via an HTML `<form>` with a Server Action bound to the task ID, requiring no `"use client"` code.

## Server Action

Add `deleteTask(id: string)` to `src/actions/tasks.ts`:

- Calls `db.task.delete({ where: { id } })`
- Calls `revalidatePath("/logbook")` to refresh the page

## UI

Each task row in `logbook/page.tsx` gets a `<form action={deleteTask.bind(null, task.id)}>` at the trailing end of the row, containing a `<button type="submit">` with a `Trash2` icon from lucide-react. The button uses muted foreground colour with a hover state to destructive red, consistent with the app's existing destructive action styling.

## Constraints

- Logbook-only: delete is not exposed on other sections (Inbox, Scheduled, etc.)
- No undo/restore — deletion is permanent
- No confirmation dialog
- Touch devices: always-visible icon ensures the action is accessible without hover
