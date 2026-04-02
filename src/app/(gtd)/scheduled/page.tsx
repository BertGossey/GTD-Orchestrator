import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";
import { cn } from "@/lib/utils";
import type { TaskWithProject } from "@/types/gtd";

function groupTasksByDate(
  tasks: TaskWithProject[]
): { dateKey: string; tasks: TaskWithProject[] }[] {
  const groups = new Map<string, TaskWithProject[]>();
  for (const task of tasks) {
    if (!task.scheduledDate) continue;
    const dateKey = task.scheduledDate.toISOString().split("T")[0];
    const group = groups.get(dateKey) ?? [];
    group.push(task);
    groups.set(dateKey, group);
  }
  return Array.from(groups.entries()).map(([dateKey, tasks]) => ({
    dateKey,
    tasks,
  }));
}

function formatDate(dateKey: string): string {
  // Use noon UTC to avoid local-timezone date shifts when formatting
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function isWeekend(dateKey: string): boolean {
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
                  "border-l-2 px-3 py-2 rounded-sm text-sm font-medium mb-2",
                  index > 0 && "mt-4",
                  isWeekend(dateKey)
                    ? "border-muted-foreground/30 bg-muted/20 text-muted-foreground"
                    : "border-primary bg-primary/5 text-foreground"
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
