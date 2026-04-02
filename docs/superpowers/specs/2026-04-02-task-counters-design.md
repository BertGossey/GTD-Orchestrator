# Task Counters - Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Add task count badges next to Next, Waiting, Scheduled, and Someday sections, and next to each Project in the left sidebar. The Inbox already displays a count and will remain unchanged. Logbook will not display a count.

## Requirements

### Functional Requirements

1. Display count next to Next, Waiting, Scheduled, and Someday sections in the Actions menu
2. Display count next to each Project in the Projects menu
3. Keep existing Inbox count unchanged
4. Do not display count for Logbook
5. Counts update automatically when tasks are moved between sections
6. Counts only display when greater than 0

### User Experience Requirements

1. Counts are immediately visible without interaction
2. Visual style matches existing Inbox count badge
3. Counts update on page navigation/revalidation (consistent with current inbox behavior)
4. No loading states or flicker (server-rendered)

## Design Decisions

### Approach: Server-Side Counts with Revalidation

**Decision:** Query all section counts and project task counts in the layout server component, pass them down to the sidebar.

**Rationale:**
- Follows existing inbox count pattern
- Leverages Next.js revalidation already in place for task mutations
- Simple and maintainable
- Accurate counts without complex client-side state management
- All queries run in parallel, so minimal performance impact

**Alternative Approaches Considered:**
- Real-time client state: Rejected due to complexity and potential sync issues
- Optimistic updates: Rejected as over-engineering for this use case

### Count Display Pattern

**Decision:** Use Badge component (same as Inbox) with variant="secondary"

**Rationale:**
- Visual consistency with existing inbox count
- Familiar UI pattern
- Built-in Tailwind styling
- Only shows when count > 0

### Query Strategy

**Decision:** Run all count queries in parallel using Promise.all in the layout

**Rationale:**
- No waterfall delays
- Efficient database queries using count operations
- Existing indexes on section field optimize performance
- Single round-trip to database

## Architecture

### Data Layer

**File:** `src/actions/tasks.ts`

Add new server action for section counts:

```typescript
export async function getSectionCounts() {
  const [next, waiting, scheduled, someday] = await Promise.all([
    db.task.count({ where: { section: "NEXT" } }),
    db.task.count({ where: { section: "WAITING" } }),
    db.task.count({ where: { section: "SCHEDULED" } }),
    db.task.count({ where: { section: "SOMEDAY" } }),
  ]);
  
  return { next, waiting, scheduled, someday };
}
```

**File:** `src/actions/projects.ts`

Add new server action for project task counts:

```typescript
export async function getProjectTaskCounts() {
  const projects = await db.project.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      _count: {
        select: { tasks: true }
      }
    }
  });
  
  return projects.reduce((acc, p) => {
    acc[p.id] = p._count.tasks;
    return acc;
  }, {} as Record<string, number>);
}
```

**Database Performance:**
- Section counts use existing `@@index([section, sortOrder])` on Task model
- Project counts use built-in Prisma `_count` aggregation
- All queries run in parallel via Promise.all
- No N+1 query issues

### Layout Integration

**File:** `src/app/(gtd)/layout.tsx`

Update to fetch counts alongside existing data:

```typescript
import { getActiveProjects, getProjectTaskCounts } from "@/actions/projects";
import { getInboxCount, getSectionCounts } from "@/actions/tasks";

export default async function GtdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, inboxCount, sectionCounts, projectCounts] = await Promise.all([
    getActiveProjects(),
    getInboxCount(),
    getSectionCounts(),
    getProjectTaskCounts(),
  ]);

  return (
    <GtdLayoutClient 
      projects={projects} 
      inboxCount={inboxCount}
      sectionCounts={sectionCounts}
      projectCounts={projectCounts}
    >
      {children}
    </GtdLayoutClient>
  );
}
```

**Cache Revalidation:**
Existing `revalidatePath("/", "layout")` calls in task mutation actions (moveTask, updateTask, etc.) will automatically refresh all counts when tasks are moved.

### Component Updates

**File:** `src/components/gtd/gtd-layout-client.tsx`

Update props to pass counts to sidebar:

```typescript
export function GtdLayoutClient({
  projects,
  inboxCount,
  sectionCounts,
  projectCounts,
  children,
}: {
  projects: Project[];
  inboxCount: number;
  sectionCounts: { next: number; waiting: number; scheduled: number; someday: number };
  projectCounts: Record<string, number>;
  children: React.ReactNode;
}) {
  // ... existing code ...
  
  return (
    <GtdSidebar
      projects={projects}
      inboxCount={inboxCount}
      sectionCounts={sectionCounts}
      projectCounts={projectCounts}
      onAddProject={() => setShowProjectForm(true)}
    />
  );
}
```

**File:** `src/components/gtd/sidebar.tsx`

1. Update component signature to accept new props
2. Map section counts to action items:

```typescript
const actionItemsWithCounts = actionItems.map((item) => {
  const countKey = item.label.toLowerCase() as keyof typeof sectionCounts;
  return { ...item, count: sectionCounts[countKey] };
});
```

3. Update action items rendering to use `actionItemsWithCounts` instead of `actionItems`

4. Add count Badge to project links (inside the Link component):

```typescript
{projects.map((project) => {
  const taskCount = projectCounts[project.id] || 0;
  return (
    <Link key={project.id} href={`/projects/${project.id}`} className="...">
      <FolderOpen className="size-4" />
      <span className="flex-1 truncate">{project.title}</span>
      {taskCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {taskCount}
        </Badge>
      )}
    </Link>
  );
})}
```

**Visual Pattern:**
- Badge uses same styling as existing inbox count
- Only displays when count > 0
- Right-aligned in nav item
- Uses secondary variant for consistency

## Type Definitions

**Type:** Section counts structure

```typescript
type SectionCounts = {
  next: number;
  waiting: number;
  scheduled: number;
  someday: number;
};
```

**Type:** Project counts structure

```typescript
type ProjectCounts = Record<string, number>;
```

These types ensure type safety when passing counts through components.

## Error Handling

**Database Errors:** If count queries fail, the layout will fail to render (standard Next.js behavior). This is acceptable as counts are essential data, not optional enhancements.

**Missing Counts:** Project counts default to 0 for projects not in the map (using `projectCounts[project.id] || 0`).

**Validation:** No validation needed - database constraints ensure counts are non-negative integers.

## Testing Considerations

**Manual Testing:**
1. Create tasks in Next, Waiting, Scheduled, Someday sections → Verify counts display
2. Move task between sections → Verify counts update after page revalidation
3. Delete task → Verify count decrements
4. Create project with tasks → Verify project count displays
5. Move task to different project → Verify both project counts update
6. Delete project → Verify count removes (project disappears)

**Edge Cases:**
- Section with 0 tasks → Badge should not display
- Project with 0 tasks → Badge should not display
- Multiple tasks in same section → Count should be accurate
- Tasks without project (null projectId) → Not counted in any project

## Performance Considerations

**Query Performance:**
- Section counts: Single query with WHERE clause using indexed column
- Project counts: Single query with `_count` aggregation
- All queries run in parallel
- No N+1 issues
- Existing indexes optimize section queries

**Rendering:**
- Server-side rendering, no client-side computation
- Static Badge component, minimal re-render cost
- Counts cached until revalidation

**Scalability:**
- Counts scale linearly with number of tasks
- Database indexes ensure efficient queries even with large datasets
- Parallel queries prevent cumulative latency

## Future Extensibility

**Potential Enhancements:**
- Add Logbook count if desired (simple prop addition)
- Add tooltips showing count breakdown (e.g., "5 tasks: 2 today, 3 upcoming")
- Add color coding for overdue tasks in counts
- Add filtering to exclude completed tasks from project counts
- Add real-time updates via WebSocket/polling

All of these can be added without changing the current architecture.

## Implementation Notes

**Files to Modify:**
1. `src/actions/tasks.ts` - Add getSectionCounts function
2. `src/actions/projects.ts` - Add getProjectTaskCounts function
3. `src/app/(gtd)/layout.tsx` - Fetch counts and pass to client
4. `src/components/gtd/gtd-layout-client.tsx` - Accept and pass counts to sidebar
5. `src/components/gtd/sidebar.tsx` - Display counts in UI

**No Database Changes Required:**
- Uses existing schema and indexes
- No migrations needed

**Testing:**
- Add unit tests for getSectionCounts function
- Add unit tests for getProjectTaskCounts function
- Manual testing for UI display and revalidation behavior
