# Auto Project Assignment — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Summary

When creating a task, the LLM automatically assigns it to a project if it finds a clear match based on the task input and the titles/descriptions of all active projects. If uncertain or no good match exists, the project field is left empty. If there are no active projects, the project matching logic is skipped entirely.

## Architecture

Changes are confined to two files: `src/lib/ai.ts` (enrichment logic) and `src/actions/tasks.ts` (task creation). No new files. No schema changes — `projectId` is already a field on the `Task` model.

## `src/lib/ai.ts`

### `EnrichmentResult` type

Add `projectId: string | null`:

```ts
export type EnrichmentResult = {
  title: string;
  description: string | null;
  dueDate: string | null;
  projectId: string | null;
};
```

### `enrichTask` signature

Add an optional second parameter:

```ts
export async function enrichTask(
  rawInput: string,
  projects?: { id: string; title: string; description: string | null }[]
): Promise<EnrichmentResult>
```

### System prompt

When `projects` is provided and non-empty, append a projects section to the system prompt:

```
Available projects (only assign if clearly relevant — when uncertain, use null):
[1] "Project Title" — Project description or "no description"
[2] "Another Project" — ...

- "projectIndex": 1-based integer from the list if the task clearly belongs to a project, or null if uncertain or no good match
```

When `projects` is not provided or empty, the `projectIndex` field is omitted from the prompt entirely.

### Index-to-ID mapping

The LLM returns a 1-based integer index, not a UUID (prevents hallucination). After parsing:

```ts
const projectIndex = parsed.projectIndex ?? null;
const projectId =
  projects && projectIndex !== null && projectIndex >= 1 && projectIndex <= projects.length
    ? projects[projectIndex - 1].id
    : null;
```

### Few-shot examples

All three existing assistant responses are updated to include `"projectIndex": null`, keeping the output format consistent whether or not a projects list is present.

## `src/actions/tasks.ts`

### `createTask` changes

1. Fetch active projects before calling `enrichTask`:
   ```ts
   const activeProjects = await getActiveProjects();
   const projectsForEnrichment = activeProjects.length > 0
     ? activeProjects.map((p) => ({ id: p.id, title: p.title, description: p.description ?? null }))
     : undefined;
   ```

2. Pass projects to `enrichTask`:
   ```ts
   const enriched = await enrichTask(rawInput, projectsForEnrichment);
   ```

3. Save `projectId` from the enrichment result:
   ```ts
   const task = await db.task.create({
     data: {
       rawInput,
       title,
       description,
       dueDate,
       projectId: enriched.projectId,  // new
       section: "INBOX",
       sortOrder: nextOrder,
     },
   });
   ```

4. `projectId` is initialised to `null` in the fallback path (when enrichment throws).

## Constraints

- If `projects` is empty or undefined, `enrichTask` behaves identically to before this change
- The LLM must return a 1-based integer index or `null` — never a UUID
- Out-of-range, missing, or non-integer `projectIndex` values all map to `null`
- `projectId` in the fallback (enrichment error) is `null`
- No changes to any other server actions, UI components, or the Prisma schema
