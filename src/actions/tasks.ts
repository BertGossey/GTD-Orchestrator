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
 * Within same day: preserves the moved task's time, renumbers sortOrder.
 * Across days: adopts target task's time, moves to target day.
 */
export async function reorderScheduledTasks(
  movedTaskId: string,
  targetTaskId: string
) {
  // Fetch the moved task's current scheduledDate
  const movedTask = await db.task.findUniqueOrThrow({
    where: { id: movedTaskId },
    select: { scheduledDate: true },
  });

  if (!movedTask.scheduledDate) {
    throw new Error("Moved task has no scheduledDate");
  }

  // Fetch the target task's scheduledDate to determine target day
  const targetTask = await db.task.findUniqueOrThrow({
    where: { id: targetTaskId },
    select: { scheduledDate: true },
  });

  if (!targetTask.scheduledDate) {
    throw new Error("Target task has no scheduledDate");
  }

  const movedDateKey = extractDateKey(movedTask.scheduledDate);
  const targetDateKey = extractDateKey(targetTask.scheduledDate);
  const sameDay = movedDateKey === targetDateKey;

  // Calculate target day boundaries (start of day, start of next day)
  const targetDate = targetTask.scheduledDate;
  const targetDayStart = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    0,
    0,
    0,
    0
  );
  const targetDayEnd = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate() + 1,
    0,
    0,
    0,
    0
  );

  // Fetch all tasks in the target day
  const tasksInTargetDay = await db.task.findMany({
    where: {
      section: "SCHEDULED",
      scheduledDate: {
        gte: targetDayStart,
        lt: targetDayEnd,
      },
    },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  // Remove movedTask from the list if it's already in the target day
  const filteredTasks = tasksInTargetDay.filter((t) => t.id !== movedTaskId);

  // Find the target task's index in the filtered list
  const targetIndex = filteredTasks.findIndex((t) => t.id === targetTaskId);
  if (targetIndex === -1) {
    throw new Error("Target task not found in target day");
  }

  // Insert movedTask after targetTask
  const reorderedIds = [
    ...filteredTasks.slice(0, targetIndex + 1),
    { id: movedTaskId },
    ...filteredTasks.slice(targetIndex + 1),
  ].map((t) => t.id);

  // Build updates array
  const updates = reorderedIds.map((id, index) => {
    if (id === movedTaskId) {
      // For the moved task, update both sortOrder and possibly scheduledDate
      const newScheduledDate = sameDay
        ? movedTask.scheduledDate
        : targetTask.scheduledDate;
      return db.task.update({
        where: { id },
        data: {
          sortOrder: index,
          scheduledDate: newScheduledDate,
        },
      });
    } else {
      // For other tasks, only update sortOrder
      return db.task.update({
        where: { id },
        data: { sortOrder: index },
      });
    }
  });

  await db.$transaction(updates);
  revalidatePath("/", "layout");
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
