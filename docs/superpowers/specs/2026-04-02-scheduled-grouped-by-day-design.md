# Scheduled View — Grouped by Day Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Summary

Update the Scheduled view so tasks are grouped by their scheduled date. Each date gets a styled divider showing the day of week and date. Workdays and weekends use distinct color schemes. Only dates that have tasks are shown. Tasks within each day group remain drag-and-drop sortable.

## Architecture

Single file change: `src/app/(gtd)/scheduled/page.tsx`. No new components. The existing `TaskList` is reused per day group — each instance gets its own `SortableContext` with that day's task IDs, so drag-and-drop within a day works without any changes to the DnD setup.

## Data Grouping

Tasks are already fetched sorted by `scheduledDate asc` via `getTasksBySection("SCHEDULED")`. The page reduces this array into an ordered list of `{ dateKey: string; tasks: TaskWithProject[] }` groups, where `dateKey` is the ISO date portion (`YYYY-MM-DD`) of `scheduledDate`. Tasks without a `scheduledDate` are skipped (defensive — cannot occur in the SCHEDULED section).

## Date Divider

Each group renders a divider `<div>` above its `TaskList`:

- **Label format:** `toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })` → e.g. "Monday, April 7"
- **Weekend detection:** `new Date(dateKey).getUTCDay()` returns 0 (Sunday) or 6 (Saturday)

### Styling

| Day type | Tailwind classes |
|---|---|
| Workday (Mon–Fri) | `border-l-2 border-primary bg-primary/5 text-foreground font-medium` |
| Weekend (Sat–Sun) | `border-l-2 border-muted-foreground/30 bg-muted/20 text-muted-foreground font-medium` |

Both dividers use `px-3 py-2 rounded-sm text-sm mb-2 mt-4` for spacing and shape. The first group omits the `mt-4` top margin.

## Empty State

Unchanged: when no tasks are scheduled, render the existing "No scheduled tasks" message.

## Constraints

- No changes to `TaskList`, `TaskRow`, or any DnD configuration
- No new files
- Drag-and-drop between day groups is not supported (each group is its own `SortableContext`)
- The `getTasksBySection` query already orders by `scheduledDate asc` — no query changes needed
