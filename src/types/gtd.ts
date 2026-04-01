import type { Task, Project, TaskSection } from "@/generated/prisma/client";

export type { Task, Project, TaskSection };

// Re-export the enrichment result type from ai.ts
export type { EnrichmentResult } from "@/lib/ai";

// Props for task list components
export type TaskWithProject = Task & {
  project: Project | null;
};
