"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrichTask } from "@/lib/ai";
import { getActiveProjects } from "@/actions/projects";
import type { TaskSection } from "@/generated/prisma/client";

export async function createTask(rawInput: string) {
  // Get next sort order for INBOX
  const maxOrder = await db.task.aggregate({
    where: { section: "INBOX" },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  let title = rawInput;
  let description: string | null = null;
  let dueDate: Date | null = null;
  let projectId: string | null = null;

  try {
    const activeProjects = await getActiveProjects();
    const projectsForEnrichment =
      activeProjects.length > 0
        ? activeProjects.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description ?? null,
          }))
        : undefined;

    const enriched = await enrichTask(rawInput, projectsForEnrichment);
    title = enriched.title;
    description = enriched.description;
    dueDate = enriched.dueDate ? new Date(enriched.dueDate) : null;
    projectId = enriched.projectId;
  } catch (error) {
    console.error("Task enrichment failed:", error);
  }

  const task = await db.task.create({
    data: {
      rawInput,
      title,
      description,
      dueDate,
      projectId,
      section: "INBOX",
      sortOrder: nextOrder,
    },
  });

  revalidatePath("/inbox");
  return task;
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    dueDate?: Date | null;
    scheduledDate?: Date | null;
    waitingFor?: string | null;
    projectId?: string | null;
  }
) {
  const task = await db.task.update({
    where: { id },
    data,
  });

  revalidatePath("/", "layout");
  return task;
}

export async function moveTask(
  id: string,
  targetSection: TaskSection,
  scheduledDate?: Date
) {
  // Fetch current task to know source section
  const current = await db.task.findUniqueOrThrow({ where: { id } });

  // Get next sort order in target section
  const maxOrder = await db.task.aggregate({
    where: { section: targetSection },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const updateData: Record<string, unknown> = {
    section: targetSection,
    sortOrder: nextOrder,
  };

  // Clear stale fields when leaving a section
  if (current.section === "WAITING" && targetSection !== "WAITING") {
    updateData.waitingFor = null;
  }
  if (current.section === "SCHEDULED" && targetSection !== "SCHEDULED") {
    updateData.scheduledDate = null;
  }
  if (current.section === "LOGBOOK" && targetSection !== "LOGBOOK") {
    updateData.completedAt = null;
  }

  if (targetSection === "LOGBOOK") {
    updateData.completedAt = new Date();
  }

  if (targetSection === "SCHEDULED" && scheduledDate) {
    updateData.scheduledDate = scheduledDate;
  }

  const task = await db.task.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/", "layout");
  return task;
}

export async function reorderTasks(
  section: TaskSection,
  orderedIds: string[]
) {
  // Update sortOrder for each task in the new order
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.task.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/", "layout");
}

export async function completeTask(id: string) {
  return moveTask(id, "LOGBOOK");
}

export async function getTasksBySection(section: TaskSection) {
  return db.task.findMany({
    where: { section },
    orderBy: section === "SCHEDULED"
      ? { scheduledDate: "asc" }
      : { sortOrder: "asc" },
    include: { project: true },
  });
}

export async function getInboxCount() {
  return db.task.count({ where: { section: "INBOX" } });
}

export async function getSectionCounts() {
  const [next, waiting, scheduled, someday] = await Promise.all([
    db.task.count({ where: { section: "NEXT" } }),
    db.task.count({ where: { section: "WAITING" } }),
    db.task.count({ where: { section: "SCHEDULED" } }),
    db.task.count({ where: { section: "SOMEDAY" } }),
  ]);

  return { next, waiting, scheduled, someday };
}

export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
  revalidatePath("/logbook");
}

/**
 * Extract YYYY-MM-DD date key from a Date object.
 * Used for grouping and comparing scheduled tasks by date.
 */
export function extractDateKey(date: Date | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
