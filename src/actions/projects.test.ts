import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    project: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import {
  createProject,
  updateProject,
  getActiveProjects,
  getProjectWithTasks,
  deleteProject,
  getProjectTaskCounts,
} from "./projects";
import { Prisma } from "@/generated/prisma/client";

describe("createProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates project with title and description", async () => {
    const mockProject = { id: "p1", title: "Work", description: "Work tasks" };
    vi.mocked(db.project.create).mockResolvedValue(mockProject as never);

    const result = await createProject("Work", "Work tasks");

    expect(db.project.create).toHaveBeenCalledWith({
      data: { title: "Work", description: "Work tasks" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result).toEqual(mockProject);
  });

  it("creates project with title only", async () => {
    vi.mocked(db.project.create).mockResolvedValue({ id: "p1" } as never);

    await createProject("Personal");

    expect(db.project.create).toHaveBeenCalledWith({
      data: { title: "Personal", description: undefined },
    });
  });
});

describe("updateProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates project with provided fields", async () => {
    const mockProject = { id: "p1", title: "Updated" };
    vi.mocked(db.project.update).mockResolvedValue(mockProject as never);

    const result = await updateProject("p1", { title: "Updated" });

    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { title: "Updated" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result).toEqual(mockProject);
  });

  it("can update status to INACTIVE", async () => {
    vi.mocked(db.project.update).mockResolvedValue({ id: "p1" } as never);

    await updateProject("p1", { status: "INACTIVE" });

    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "INACTIVE" },
    });
  });
});

describe("getActiveProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active projects ordered by createdAt", async () => {
    const mockProjects = [{ id: "p1" }, { id: "p2" }];
    vi.mocked(db.project.findMany).mockResolvedValue(mockProjects as never);

    const result = await getActiveProjects();

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    expect(result).toEqual(mockProjects);
  });
});

describe("getProjectWithTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns project with tasks included", async () => {
    const mockProject = { id: "p1", tasks: [{ id: "t1" }] };
    vi.mocked(db.project.findUnique).mockResolvedValue(mockProject as never);

    const result = await getProjectWithTasks("p1");

    expect(db.project.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
      include: {
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: { project: true },
        },
      },
    });
    expect(result).toEqual(mockProject);
  });

  it("returns null when project not found", async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null as never);

    const result = await getProjectWithTasks("nonexistent");

    expect(result).toBeNull();
  });
});

describe("deleteProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes project and revalidates path", async () => {
    vi.mocked(db.project.delete).mockResolvedValue({ id: "p1" } as never);

    const result = await deleteProject("p1");

    expect(db.project.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result).toEqual({ success: true });
  });

  it("returns error when project not found (P2025)", async () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError(
      "An operation failed because it depends on one or more records that were required but not found.",
      {
        code: "P2025",
        clientVersion: "5.0.0",
      }
    );
    vi.mocked(db.project.delete).mockRejectedValue(notFoundError);

    const result = await deleteProject("nonexistent");

    expect(result).toEqual({
      success: false,
      error: "Project not found",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns error and logs when database operation fails", async () => {
    const dbError = new Error("Database connection failed");
    vi.mocked(db.project.delete).mockRejectedValue(dbError);
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await deleteProject("p1");

    expect(result).toEqual({
      success: false,
      error: "Failed to delete project",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to delete project:",
      dbError
    );
    expect(revalidatePath).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("getProjectTaskCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns task counts for all active projects", async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: "p1", _count: { tasks: 5 } },
      { id: "p2", _count: { tasks: 3 } },
      { id: "p3", _count: { tasks: 0 } },
    ] as never);

    const result = await getProjectTaskCounts();

    expect(db.project.findMany).toHaveBeenCalledWith({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        _count: {
          select: { tasks: true },
        },
      },
    });
    expect(result).toEqual({
      p1: 5,
      p2: 3,
      p3: 0,
    });
  });

  it("returns empty object when no projects exist", async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([] as never);

    const result = await getProjectTaskCounts();

    expect(result).toEqual({});
  });
});
