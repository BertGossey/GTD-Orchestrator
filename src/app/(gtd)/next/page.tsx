import { getTasksBySection } from "@/actions/tasks";
import { getActiveProjects } from "@/actions/projects";
import { TaskListWithProvider } from "@/components/gtd/task-list-with-provider";

export default async function NextPage() {
  const [tasks, projects] = await Promise.all([
    getTasksBySection("NEXT"),
    getActiveProjects(),
  ]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Next Actions</h1>
      <TaskListWithProvider
        tasks={tasks}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        sectionId="NEXT"
      />
    </div>
  );
}
