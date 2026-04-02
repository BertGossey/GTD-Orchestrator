import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/gtd";

export function groupTasksByDate(
  tasks: TaskWithProject[]
): { dateKey: string; tasks: TaskWithProject[] }[] {
  const groups = new Map<string, TaskWithProject[]>();
  for (const task of tasks) {
    if (!task.scheduledDate) continue;
    // Use local timezone to avoid date shifts when grouping
    const year = task.scheduledDate.getFullYear();
    const month = String(task.scheduledDate.getMonth() + 1).padStart(2, "0");
    const day = String(task.scheduledDate.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const group = groups.get(dateKey) ?? [];
    group.push(task);
    groups.set(dateKey, group);
  }
  return Array.from(groups.entries()).map(([dateKey, groupTasks]) => ({
    dateKey,
    tasks: groupTasks,
  }));
}

export function formatDate(dateKey: string): string {
  // Use noon UTC to avoid local-timezone date shifts when formatting
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function isWeekend(dateKey: string): boolean {
  const day = new Date(dateKey).getUTCDay();
  return day === 0 || day === 6;
}

export default async function ScheduledPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("SCHEDULED"),
    getActiveProjects(),
  ]);

  const projectList = projects.map((p) => ({ id: p.id, title: p.title }));
  const groups = groupTasksByDate(tasks);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Scheduled</h1>
      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No scheduled tasks
        </p>
      ) : (
        <div>
          {groups.map(({ dateKey, tasks: dayTasks }, index) => (
            <div key={dateKey}>
              <div
                className={cn(
                  "border border-l-2 px-3 py-2 rounded-sm text-sm font-semibold mb-2 bg-muted/20 text-foreground",
                  index > 0 && "mt-4",
                  isWeekend(dateKey)
                    ? "border-green-100 border-l-green-300"
                    : "border-red-100 border-l-red-300"
                )}
              >
                {formatDate(dateKey)}
              </div>
              <TaskList
                tasks={dayTasks}
                projects={projectList}
                sectionId="SCHEDULED"
                droppableId={`SCHEDULED-${dateKey}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
