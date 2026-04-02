import { GtdLayoutClient } from "@/components/gtd/gtd-layout-client";
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
