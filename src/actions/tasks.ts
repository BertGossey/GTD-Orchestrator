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

/**
 * Reorder a scheduled task relative to another scheduled task.
 * Handles both within-day and cross-day reordering.
 *
 * Handles sortOrder updates for all affected tasks.
 *
 * @param taskId - ID of task to reorder
 * @param targetDateKey - Target date in YYYY-MM-DD format
 * @param newIndex - Target position (0-based index)
 * @param _sameDayMove - Not currently used (time is always preserved if available)
 */
export async function reorderScheduledTasks(
  taskId: string,
  targetDateKey: string,
  newIndex: number,
  _sameDayMove: boolean
) {
  // Fetch the task being moved
  const task = await db.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { scheduledDate: true, sortOrder: true },
  });

  // Parse target date
  const [year, month, day] = targetDateKey.split("-").map(Number);

  // Preserve time component or use midnight
  const hours = task.scheduledDate?.getHours() ?? 0;
  const minutes = task.scheduledDate?.getMinutes() ?? 0;
  const seconds = task.scheduledDate?.getSeconds() ?? 0;
  const newDate = new Date(year, month - 1, day, hours, minutes, seconds);

  // Get all tasks for the target day (excluding the task being moved)
  const targetDayStart = new Date(year, month - 1, day, 0, 0, 0);
  const targetDayEnd = new Date(year, month - 1, day, 23, 59, 59);

  const targetDayTasks = await db.task.findMany({
    where: {
      section: "SCHEDULED",
      scheduledDate: {
        gte: targetDayStart,
        lte: targetDayEnd,
      },
      id: { not: taskId },
    },
    orderBy: [{ sortOrder: "asc" }, { scheduledDate: "asc" }],
    select: { id: true, sortOrder: true },
  });

  // Compute new sortOrder for all tasks
  const updates: Array<{ id: string; sortOrder: number }> = [];

  // Insert the moved task at newIndex
  let currentIndex = 0;
  for (let i = 0; i <= targetDayTasks.length; i++) {
    if (i === newIndex) {
      // Skip - the moved task will be updated separately
      continue;
    } else if (currentIndex < targetDayTasks.length) {
      updates.push({
        id: targetDayTasks[currentIndex].id,
        sortOrder: i,
      });
      currentIndex++;
    }
  }

  // Execute all updates in a transaction
  await db.$transaction([
    // Update the moved task's date and sortOrder
    db.task.update({
      where: { id: taskId },
      data: {
        scheduledDate: newDate,
        sortOrder: newIndex,
      },
    }),
    // Update sortOrder for other tasks in target day
    ...updates.map((u) =>
      db.task.update({
        where: { id: u.id },
        data: { sortOrder: u.sortOrder },
      })
    ),
  ]);

  revalidatePath("/scheduled");
}

export async function completeTask(id: string) {
  return moveTask(id, "LOGBOOK");
}

export async function getTasksBySection(section: TaskSection) {
  return db.task.findMany({
    where: { section },
    orderBy: section === "SCHEDULED"
      ? [
          { scheduledDate: "asc" },
          { sortOrder: "asc" },
        ]
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

