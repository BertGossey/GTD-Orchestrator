# Project Edit Header — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Summary

Add inline editing for project title and description on the project detail page. Both fields are always-editable inputs that save on blur, following the same pattern as `TaskDetail`.

## Architecture

A new `ProjectHeader` client component handles the editable title and description. The project detail page (Server Component) passes the project data to it and stays server-rendered. No schema or server action changes are needed — `updateProject` already accepts `{ title, description }`.

## New Component: `src/components/gtd/project-header.tsx`

- `"use client"` component
- Props: `id: string`, `title: string`, `description: string`
- State: `useState` for `title` and `description`
- Saves via `updateProject(id, { title, description })` wrapped in `useTransition`
- `save()` called `onBlur` for both fields — no overrides pattern needed (both fields are plain text, no stale closure issue)
- Title: `<Input>` styled as a heading (`text-xl font-semibold`, no visible border at rest)
- Description: `<textarea>` with the same styling as in `TaskDetail`
- Shows "Saving..." while `isPending`

## Modified Page: `src/app/(gtd)/projects/[id]/page.tsx`

Replace the read-only `<h1>` and `<p>` block with:

```tsx
<ProjectHeader
  id={project.id}
  title={project.title}
  description={project.description ?? ""}
/>
```

The `<Separator>` below the header remains in place.

## Constraints

- Title must not be saved if empty — falls back to the original title prop: `title.trim() || initialTitle` (keep current value if user clears it)
- Description is optional — saved as `null` if blank
- No confirmation, no cancel button — saves immediately on blur
