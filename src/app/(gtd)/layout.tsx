import { GtdLayoutClient } from "@/components/gtd/gtd-layout-client";
import { getActiveProjects, getProjectTaskCounts } from "@/actions/projects";
import { getInboxCount, getSectionCounts } from "@/actions/tasks";
import { TasksProvider } from "@/contexts/tasks-context";

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
    <TasksProvider>
      <GtdLayoutClient
        projects={projects}
        inboxCount={inboxCount}
        sectionCounts={sectionCounts}
        projectCounts={projectCounts}
      >
        {children}
      </GtdLayoutClient>
    </TasksProvider>
  );
}
