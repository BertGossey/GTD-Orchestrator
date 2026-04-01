"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { enrichTask } from "@/lib/ai";
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

  try {
    const enriched = await enrichTask(rawInput);
    title = enriched.title;
    description = enriched.description;
    dueDate = enriched.dueDate ? new Date(enriched.dueDate) : null;
  } catch {
    // Fallback: use rawInput as title
  }

  const task = await db.task.create({
    data: {
      rawInput,
      title,
      description,
      dueDate,
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
