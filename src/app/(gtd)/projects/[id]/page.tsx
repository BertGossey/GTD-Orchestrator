import { notFound } from "next/navigation";
import { getProjectWithTasks } from "@/actions/projects";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";
import { Separator } from "@/components/ui/separator";
import type { TaskSection } from "@/generated/prisma/client";

const sectionLabels: Record<string, string> = {
  INBOX: "Inbox",
  NEXT: "Next",
  WAITING: "Waiting",
  SCHEDULED: "Scheduled",
  SOMEDAY: "Someday",
};

const sectionOrder: TaskSection[] = ["INBOX", "NEXT", "WAITING", "SCHEDULED", "SOMEDAY"];

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, allProjects] = await Promise.all([
    getProjectWithTasks(id),
    getActiveProjects(),
  ]);

  if (!project) {
    notFound();
  }

  const projectList = allProjects.map((p) => ({ id: p.id, title: p.title }));

  const tasksBySection = sectionOrder
    .map((section) => ({
      section,
      label: sectionLabels[section],
      tasks: project.tasks.filter((t) => t.section === section),
    }))
    .filter((group) => group.tasks.length > 0);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">{project.title}</h1>
      {project.description && (
        <p className="mb-4 text-sm text-muted-foreground">
          {project.description}
        </p>
      )}
      <Separator className="mb-6" />

      {tasksBySection.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tasks in this project
        </p>
      ) : (
        <div className="space-y-6">
          {tasksBySection.map(({ section, label, tasks }) => (
            <div key={section}>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </h2>
              <TaskList
                tasks={tasks}
                projects={projectList}
                sectionId={section}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
