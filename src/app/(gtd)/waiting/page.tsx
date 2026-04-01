import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskList } from "@/components/gtd/task-list";

export default async function WaitingPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("WAITING"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Waiting</h1>
      <TaskList
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="WAITING"
      />
    </div>
  );
}
