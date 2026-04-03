import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";

export default async function SomedayPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("SOMEDAY"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Someday</h1>
      <TaskListWithProvider
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="SOMEDAY"
      />
    </div>
  );
}
