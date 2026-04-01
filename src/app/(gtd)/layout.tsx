import { GtdLayoutClient } from "@/components/gtd/gtd-layout-client";
import { getActiveProjects } from "@/actions/projects";
import { getInboxCount } from "@/actions/tasks";

export default async function GtdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, inboxCount] = await Promise.all([
    getActiveProjects(),
    getInboxCount(),
  ]);

  return (
    <GtdLayoutClient projects={projects} inboxCount={inboxCount}>
      {children}
    </GtdLayoutClient>
  );
}
