"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { ProjectStatus } from "@/generated/prisma/client";

export async function createProject(title: string, description?: string) {
  const project = await db.project.create({
    data: { title, description },
  });

  revalidatePath("/", "layout");
  return project;
}

export async function updateProject(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    status?: ProjectStatus;
  }
) {
  const project = await db.project.update({
    where: { id },
    data,
  });

  revalidatePath("/", "layout");
  return project;
}

export async function getActiveProjects() {
  return db.project.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectWithTasks(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: { project: true },
      },
    },
  });
}

export async function deleteProject(id: string) {
  await db.project.delete({
    where: { id },
  });

  revalidatePath("/", "layout");
  return { success: true };
}
