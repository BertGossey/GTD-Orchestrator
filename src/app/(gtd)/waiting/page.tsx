import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";

export default async function WaitingPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("WAITING"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Waiting</h1>
      <TaskListWithProvider
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="WAITING"
      />
    </div>
  );
}
