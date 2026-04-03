import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/ai", () => ({
  enrichTask: vi.fn(),
}));

vi.mock("@/actions/projects", () => ({
  getActiveProjects: vi.fn(),
}));

import { db } from "@/lib/db";
import { enrichTask } from "@/lib/ai";
import { getActiveProjects } from "@/actions/projects";
import {
  createTask,
  updateTask,
  moveTask,
  reorderTasks,
  reorderScheduledTasks,
  completeTask,
  getTasksBySection,
  getInboxCount,
  deleteTask,
  getSectionCounts,
  extractDateKey,
} from "./tasks";

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveProjects).mockResolvedValue([] as never);
  });

  it("creates a task with AI-enriched fields", async () => {
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: 2 },
    } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Buy groceries",
      description: "Get milk and eggs",
      dueDate: "2026-04-05",
      projectId: null,
    });
    const mockTask = { id: "1", title: "Buy groceries" };
    vi.mocked(db.task.create).mockResolvedValue(mockTask as never);

    const result = await createTask("buy groceries tomorrow");

    expect(enrichTask).toHaveBeenCalledWith("buy groceries tomorrow", undefined);
    expect(db.task.create).toHaveBeenCalledWith({
      data: {
        rawInput: "buy groceries tomorrow",
        title: "Buy groceries",
        description: "Get milk and eggs",
        dueDate: new Date("2026-04-05"),
        projectId: null,
        section: "INBOX",
        sortOrder: 3,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/inbox");
    expect(result).toEqual(mockTask);
  });

  it("calculates sortOrder 0 when no existing tasks", async () => {
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Test",
      description: null,
      dueDate: null,
      projectId: null,
    });
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("test");

    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sortOrder: 0 }),
      })
    );
  });

  it("falls back to rawInput when enrichTask throws", async () => {
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(enrichTask).mockRejectedValue(new Error("API error"));
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("my raw task");

    expect(db.task.create).toHaveBeenCalledWith({
      data: {
        rawInput: "my raw task",
        title: "my raw task",
        description: null,
        dueDate: null,
        projectId: null,
        section: "INBOX",
        sortOrder: 0,
      },
    });
  });

  it("handles null dueDate from enrichment", async () => {
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "No date task",
      description: null,
      dueDate: null,
      projectId: null,
    });
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("no date");

    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dueDate: null }),
      })
    );
  });

  it("passes active projects to enrichTask when projects exist", async () => {
    const mockProjects = [
      { id: "proj-1", title: "Work", description: "Work tasks", status: "ACTIVE", createdAt: new Date() },
    ];
    vi.mocked(getActiveProjects).mockResolvedValue(mockProjects as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Test",
      description: null,
      dueDate: null,
      projectId: "proj-1",
    });
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("fix the login bug");

    expect(enrichTask).toHaveBeenCalledWith("fix the login bug", [
      { id: "proj-1", title: "Work", description: "Work tasks" },
    ]);
  });

  it("passes undefined to enrichTask when no active projects", async () => {
    vi.mocked(getActiveProjects).mockResolvedValue([] as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Test",
      description: null,
      dueDate: null,
      projectId: null,
    });
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("buy milk");

    expect(enrichTask).toHaveBeenCalledWith("buy milk", undefined);
  });

  it("saves projectId returned from enrichment", async () => {
    vi.mocked(getActiveProjects).mockResolvedValue([
      { id: "proj-1", title: "Work", description: null, status: "ACTIVE", createdAt: new Date() },
    ] as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({ _max: { sortOrder: null } } as never);
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Fix bug",
      description: null,
      dueDate: null,
      projectId: "proj-1",
    });
    vi.mocked(db.task.create).mockResolvedValue({ id: "1" } as never);

    await createTask("fix the login bug");

    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "proj-1" }),
      })
    );
  });
});

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates task with provided data", async () => {
    const mockTask = { id: "1", title: "Updated" };
    vi.mocked(db.task.update).mockResolvedValue(mockTask as never);

    const result = await updateTask("1", { title: "Updated" });

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { title: "Updated" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(result).toEqual(mockTask);
  });

  it("supports partial updates", async () => {
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await updateTask("1", { description: "New desc", projectId: "p1" });

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { description: "New desc", projectId: "p1" },
    });
  });
});

describe("moveTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves task from INBOX to NEXT", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "INBOX",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: 3 },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "NEXT");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { section: "NEXT", sortOrder: 4 },
    });
  });

  it("clears waitingFor when moving out of WAITING", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "WAITING",
      waitingFor: "John",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "NEXT");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ waitingFor: null }),
    });
  });

  it("clears scheduledDate when moving out of SCHEDULED", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "SCHEDULED",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "INBOX");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ scheduledDate: null }),
    });
  });

  it("clears completedAt when moving out of LOGBOOK", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "LOGBOOK",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "INBOX");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ completedAt: null }),
    });
  });

  it("sets completedAt when moving to LOGBOOK", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "NEXT",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "LOGBOOK");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({
        completedAt: new Date("2026-04-01T12:00:00Z"),
      }),
    });
  });

  it("sets scheduledDate when moving to SCHEDULED with date", async () => {
    const schedDate = new Date("2026-05-01");
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "INBOX",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "SCHEDULED", schedDate);

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({
        scheduledDate: schedDate,
      }),
    });
  });

  it("does not set scheduledDate when moving to SCHEDULED without date", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "INBOX",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "SCHEDULED");

    const updateData = vi.mocked(db.task.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData).not.toHaveProperty("scheduledDate");
  });

  it("does not clear waitingFor when moving within WAITING", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "WAITING",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "WAITING");

    const updateData = vi.mocked(db.task.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData).not.toHaveProperty("waitingFor");
  });

  it("calculates sortOrder 0 in empty target section", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "INBOX",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "NEXT");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({ sortOrder: 0 }),
    });
  });

  it("calls revalidatePath after move", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "INBOX",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await moveTask("1", "NEXT");

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("reorderTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates sortOrder for each task in order", async () => {
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await reorderTasks("NEXT", ["a", "b", "c"]);

    expect(db.task.update).toHaveBeenCalledTimes(3);
    expect(db.task.update).toHaveBeenNthCalledWith(1, {
      where: { id: "a" },
      data: { sortOrder: 0 },
    });
    expect(db.task.update).toHaveBeenNthCalledWith(2, {
      where: { id: "b" },
      data: { sortOrder: 1 },
    });
    expect(db.task.update).toHaveBeenNthCalledWith(3, {
      where: { id: "c" },
      data: { sortOrder: 2 },
    });
  });

  it("calls $transaction with the update array", async () => {
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await reorderTasks("NEXT", ["a", "b"]);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("handles empty array", async () => {
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);

    await reorderTasks("NEXT", []);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("calls revalidatePath after reorder", async () => {
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);

    await reorderTasks("INBOX", []);

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("completeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves task to LOGBOOK with completedAt", async () => {
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue({
      id: "1",
      section: "NEXT",
    } as never);
    vi.mocked(db.task.aggregate).mockResolvedValue({
      _max: { sortOrder: null },
    } as never);
    vi.mocked(db.task.update).mockResolvedValue({ id: "1" } as never);

    await completeTask("1");

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: expect.objectContaining({
        section: "LOGBOOK",
        completedAt: new Date("2026-04-01T12:00:00Z"),
      }),
    });
  });
});

describe("getTasksBySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries tasks for given section with project included", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([] as never);

    await getTasksBySection("INBOX");

    expect(db.task.findMany).toHaveBeenCalledWith({
      where: { section: "INBOX" },
      orderBy: { sortOrder: "asc" },
      include: { project: true },
    });
  });

  it("orders SCHEDULED by scheduledDate then sortOrder", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([] as never);

    await getTasksBySection("SCHEDULED");

    expect(db.task.findMany).toHaveBeenCalledWith({
      where: { section: "SCHEDULED" },
      orderBy: [
        { scheduledDate: "asc" },
        { sortOrder: "asc" },
      ],
      include: { project: true },
    });
  });

  it("orders non-SCHEDULED sections by sortOrder ascending", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([] as never);

    await getTasksBySection("NEXT");

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: "asc" } })
    );
  });

  it("should order SCHEDULED tasks by date then sortOrder", async () => {
    // Create tasks that would demonstrate correct composite ordering
    // task2 and task1 are on Apr 15 (same date) but different sortOrders
    // task3 is on Apr 16 (later date)
    const task1 = {
      id: "task-1",
      title: "Task 1",
      section: "SCHEDULED" as const,
      scheduledDate: new Date(2026, 3, 15),
      sortOrder: 1,
      project: null,
      description: null,
      dueDate: null,
      projectId: null,
      rawInput: "Task 1",
      waitingFor: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task2 = {
      id: "task-2",
      title: "Task 2",
      section: "SCHEDULED" as const,
      scheduledDate: new Date(2026, 3, 15),
      sortOrder: 0,
      project: null,
      description: null,
      dueDate: null,
      projectId: null,
      rawInput: "Task 2",
      waitingFor: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const task3 = {
      id: "task-3",
      title: "Task 3",
      section: "SCHEDULED" as const,
      scheduledDate: new Date(2026, 3, 16),
      sortOrder: 0,
      project: null,
      description: null,
      dueDate: null,
      projectId: null,
      rawInput: "Task 3",
      waitingFor: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock findMany to return tasks in correct composite order
    vi.mocked(db.task.findMany).mockResolvedValue([task2, task1, task3] as never);

    const tasks = await getTasksBySection("SCHEDULED");

    // Verify correct query parameters for composite ordering
    expect(db.task.findMany).toHaveBeenCalledWith({
      where: { section: "SCHEDULED" },
      orderBy: [
        { scheduledDate: "asc" },
        { sortOrder: "asc" },
      ],
      include: { project: true },
    });

    // Verify actual returned task order matches composite ordering expectation
    expect(tasks).toHaveLength(3);
    expect(tasks[0].id).toBe("task-2"); // Apr 15, sortOrder 0
    expect(tasks[1].id).toBe("task-1"); // Apr 15, sortOrder 1
    expect(tasks[2].id).toBe("task-3"); // Apr 16, sortOrder 0
  });
});

describe("getInboxCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns count of INBOX tasks", async () => {
    vi.mocked(db.task.count).mockResolvedValue(5 as never);

    const count = await getInboxCount();

    expect(db.task.count).toHaveBeenCalledWith({
      where: { section: "INBOX" },
    });
    expect(count).toBe(5);
  });
});

describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the task by id", async () => {
    vi.mocked(db.task.delete).mockResolvedValue({ id: "1" } as never);

    await deleteTask("1");

    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: "1" } });
  });

  it("calls revalidatePath on /logbook", async () => {
    vi.mocked(db.task.delete).mockResolvedValue({ id: "1" } as never);

    await deleteTask("1");

    expect(revalidatePath).toHaveBeenCalledWith("/logbook");
  });
});

describe("getSectionCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns counts for all action sections", async () => {
    vi.mocked(db.task.count)
      .mockResolvedValueOnce(5) // NEXT
      .mockResolvedValueOnce(3) // WAITING
      .mockResolvedValueOnce(7) // SCHEDULED
      .mockResolvedValueOnce(2); // SOMEDAY

    const result = await getSectionCounts();

    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "NEXT" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "WAITING" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "SCHEDULED" } });
    expect(db.task.count).toHaveBeenCalledWith({ where: { section: "SOMEDAY" } });
    expect(result).toEqual({
      next: 5,
      waiting: 3,
      scheduled: 7,
      someday: 2,
    });
  });
});

describe("reorderScheduledTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reorder tasks within same day", async () => {
    const task1 = {
      id: "task-1",
      scheduledDate: new Date(2026, 3, 15, 10, 0, 0),
      sortOrder: 0,
    };

    // Mock findUniqueOrThrow for the task being moved
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue(task1 as never);

    // Mock findMany to return tasks in target day (excluding the moved task)
    const task2 = { id: "task-2", sortOrder: 1 };
    const task3 = { id: "task-3", sortOrder: 2 };
    vi.mocked(db.task.findMany).mockResolvedValue([task2, task3] as never);

    // Mock $transaction to resolve successfully
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);

    await reorderScheduledTasks("task-1", "2026-04-15", 2, true);

    // Verify task was fetched
    expect(db.task.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "task-1" },
      select: { scheduledDate: true, sortOrder: true },
    });

    // Verify target day tasks were fetched
    expect(db.task.findMany).toHaveBeenCalledWith({
      where: {
        section: "SCHEDULED",
        scheduledDate: {
          gte: new Date(2026, 3, 15, 0, 0, 0),
          lte: new Date(2026, 3, 15, 23, 59, 59),
        },
        id: { not: "task-1" },
      },
      orderBy: [{ sortOrder: "asc" }, { scheduledDate: "asc" }],
      select: { id: true, sortOrder: true },
    });

    // Verify transaction was called
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    // Verify sortOrder values in the transaction
    const transactionCalls = vi.mocked(db.$transaction).mock.calls[0][0];
    expect(transactionCalls).toHaveLength(3); // 1 moved task + 2 other tasks

    // Verify moved task (task-1) goes to position 2
    expect(transactionCalls[0]).toEqual(
      db.task.update({
        where: { id: "task-1" },
        data: {
          scheduledDate: new Date(2026, 3, 15, 10, 0, 0),
          sortOrder: 2,
        },
      })
    );

    // Verify task-2 stays at position 0 (was at 1, but task-1 is removed from the list)
    expect(transactionCalls[1]).toEqual(
      db.task.update({
        where: { id: "task-2" },
        data: { sortOrder: 0 },
      })
    );

    // Verify task-3 stays at position 1 (was at 2, but task-1 is removed from the list)
    expect(transactionCalls[2]).toEqual(
      db.task.update({
        where: { id: "task-3" },
        data: { sortOrder: 1 },
      })
    );

    expect(revalidatePath).toHaveBeenCalledWith("/scheduled");
  });

  it("should move task to different day", async () => {
    const task = {
      id: "task-1",
      scheduledDate: new Date(2026, 3, 15, 14, 30, 0),
      sortOrder: 0,
    };

    // Mock findUniqueOrThrow for the task being moved
    vi.mocked(db.task.findUniqueOrThrow).mockResolvedValue(task as never);

    // Mock findMany to return empty array (no tasks on target day)
    vi.mocked(db.task.findMany).mockResolvedValue([] as never);

    // Mock $transaction to resolve successfully
    vi.mocked(db.$transaction).mockResolvedValue(undefined as never);

    await reorderScheduledTasks("task-1", "2026-04-16", 0, false);

    // Verify target day tasks were fetched
    expect(db.task.findMany).toHaveBeenCalledWith({
      where: {
        section: "SCHEDULED",
        scheduledDate: {
          gte: new Date(2026, 3, 16, 0, 0, 0),
          lte: new Date(2026, 3, 16, 23, 59, 59),
        },
        id: { not: "task-1" },
      },
      orderBy: [{ sortOrder: "asc" }, { scheduledDate: "asc" }],
      select: { id: true, sortOrder: true },
    });

    // Verify transaction was called
    expect(db.$transaction).toHaveBeenCalledTimes(1);

    // Verify sortOrder values in the transaction
    const transactionCalls = vi.mocked(db.$transaction).mock.calls[0][0];
    expect(transactionCalls).toHaveLength(1); // Only the moved task (no other tasks on target day)

    // Verify moved task goes to position 0 on the new day
    expect(transactionCalls[0]).toEqual(
      db.task.update({
        where: { id: "task-1" },
        data: {
          scheduledDate: new Date(2026, 3, 16, 0, 0, 0),
          sortOrder: 0,
        },
      })
    );

    expect(revalidatePath).toHaveBeenCalledWith("/scheduled");
  });
});

describe("extractDateKey", () => {
  it("should extract YYYY-MM-DD from Date object", () => {
    const date = new Date(2026, 3, 15, 14, 30, 0); // April 15, 2026, 2:30 PM
    expect(extractDateKey(date)).toBe("2026-04-15");
  });

  it("should pad single-digit months and days with zero", () => {
    const date = new Date(2026, 0, 5, 9, 0, 0); // January 5, 2026
    expect(extractDateKey(date)).toBe("2026-01-05");
  });

  it("should return null for null input", () => {
    expect(extractDateKey(null)).toBeNull();
  });

  it("should preserve date regardless of time", () => {
    const midnight = new Date(2026, 3, 15, 0, 0, 0);
    const noon = new Date(2026, 3, 15, 12, 0, 0);
    const evening = new Date(2026, 3, 15, 23, 59, 59);

    expect(extractDateKey(midnight)).toBe("2026-04-15");
    expect(extractDateKey(noon)).toBe("2026-04-15");
    expect(extractDateKey(evening)).toBe("2026-04-15");
  });
});
