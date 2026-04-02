# Auto Project Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When creating a task, the LLM automatically assigns it to a project if it finds a clear match based on the active projects' titles and descriptions.

**Architecture:** `enrichTask` gains an optional `projects` parameter and adds `projectId` to `EnrichmentResult`. The LLM returns a 1-based index which is mapped to the real project ID in code (prevents UUID hallucination). `createTask` fetches active projects and passes them in; if none exist it passes `undefined` and the project logic is skipped entirely.

**Tech Stack:** Azure OpenAI SDK, Prisma, Vitest

---

### Task 1: Update `enrichTask` — add project matching

**Files:**
- Modify: `src/lib/ai.ts`
- Modify: `src/lib/ai.test.ts`

- [ ] **Step 1: Update existing `toEqual` assertions in `src/lib/ai.test.ts` to include `projectId: null`**

Three tests use `toEqual` on the full result object and will fail once `EnrichmentResult` gains `projectId`. Update them now so they stay green throughout.

Find and update these three assertions:

**Test "returns enriched task with all fields"** — change the `expect(result).toEqual(...)` to:
```ts
    expect(result).toEqual({
      title: "Buy groceries",
      description: "Get milk, eggs, and bread from the store",
      dueDate: "2026-04-05",
      projectId: null,
    });
```

**Test "returns fallback when response has no choices"** — change to:
```ts
    expect(result).toEqual({
      title: "some task",
      description: null,
      dueDate: null,
      projectId: null,
    });
```

**Test "returns fallback when message content is null"** — change to:
```ts
    expect(result).toEqual({
      title: "another task",
      description: null,
      dueDate: null,
      projectId: null,
    });
```

- [ ] **Step 2: Write the new failing tests — append to `src/lib/ai.test.ts` inside `describe("enrichTask")`**

Append these six tests before the closing `});` of the `describe` block:

```ts
  it("returns projectId null when no projects provided", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Test", description: null, dueDate: null, projectIndex: null }) } }],
    });

    const result = await enrichTask("test task");

    expect(result.projectId).toBeNull();
  });

  it("maps valid projectIndex to the matching project id", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Fix bug", description: null, dueDate: null, projectIndex: 2 }) } }],
    });

    const projects = [
      { id: "proj-1", title: "Personal", description: null },
      { id: "proj-2", title: "Work", description: "Work tasks" },
    ];

    const result = await enrichTask("fix the login bug", projects);

    expect(result.projectId).toBe("proj-2");
  });

  it("returns projectId null when LLM returns projectIndex null with projects", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Test", description: null, dueDate: null, projectIndex: null }) } }],
    });

    const projects = [{ id: "proj-1", title: "Work", description: null }];

    const result = await enrichTask("buy milk", projects);

    expect(result.projectId).toBeNull();
  });

  it("returns projectId null when LLM returns out-of-range projectIndex", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Test", description: null, dueDate: null, projectIndex: 5 }) } }],
    });

    const projects = [{ id: "proj-1", title: "Work", description: null }];

    const result = await enrichTask("test task", projects);

    expect(result.projectId).toBeNull();
  });

  it("includes numbered project list in system prompt when projects provided", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "T", description: null, dueDate: null, projectIndex: null }) } }],
    });

    const projects = [
      { id: "proj-1", title: "Work", description: "Work tasks" },
      { id: "proj-2", title: "Personal", description: null },
    ];

    await enrichTask("test", projects);

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain('[1] "Work"');
    expect(systemPrompt).toContain('[2] "Personal"');
  });

  it("does not include Available projects section when no projects provided", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "T", description: null, dueDate: null }) } }],
    });

    await enrichTask("test");

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).not.toContain("Available projects");
  });
```

- [ ] **Step 3: Run tests to confirm new tests fail**

```bash
npx vitest run src/lib/ai.test.ts
```

Expected: 6 FAIL (the new tests), all previous tests still PASS.

- [ ] **Step 4: Replace `src/lib/ai.ts` with the updated implementation**

```ts
import { AzureOpenAI } from "openai";

function getClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
  });
}

export type EnrichmentResult = {
  title: string;
  description: string | null;
  dueDate: string | null;
  projectId: string | null;
};

type ProjectInput = { id: string; title: string; description: string | null };

export async function enrichTask(
  rawInput: string,
  projects?: ProjectInput[]
): Promise<EnrichmentResult> {
  const client = getClient();
  const today = new Date().toISOString().split("T")[0];

  // Next Friday strictly after today (never today itself, even if today is Friday)
  const dayOfWeek = new Date().getUTCDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const fridayDate = new Date();
  fridayDate.setUTCDate(fridayDate.getUTCDate() + daysUntilFriday);
  const nextFriday = fridayDate.toISOString().split("T")[0];

  const projectsSection =
    projects && projects.length > 0
      ? `\nAvailable projects (only assign if clearly relevant — when uncertain, use null):\n${projects
          .map((p, i) => `[${i + 1}] "${p.title}" — ${p.description ?? "no description"}`)
          .join("\n")}\n- "projectIndex": 1-based integer from the list if the task clearly belongs to a project, or null if uncertain or no good match`
      : "";

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are a task assistant for a GTD app. Today is ${today}. Respond with JSON only.
Given a task description, extract:
- "title": concise, action-oriented title (max 80 chars)
- "description": expanded context from the input, or null if nothing to add
- "dueDate": ISO date string (YYYY-MM-DD), following these rules:
  1. Only set if the user explicitly mentions a date, day, or timeframe
  2. Resolve relative dates based on today (${today})
  3. If no timeframe is mentioned, set to null
  4. If the timeframe is vague urgency only ("asap", "urgent", "soon"), set to null
  5. If the resolved date is in the past, set to null${projectsSection}`,
      },
      {
        role: "user",
        content: "boodschappen doen voor vrijdag melk eieren brood",
      },
      {
        role: "assistant",
        content: `{"title": "Boodschappen doen voor vrijdag", "description": "Ga naar de winkel en koop de volgende items: melk, eieren en brood. Zorg dat dit voor vrijdag gebeurt.", "dueDate": "${nextFriday}", "projectIndex": null}`,
      },
      {
        role: "user",
        content: "need to fix the login bug on the website asap",
      },
      {
        role: "assistant",
        content: `{"title": "Fix login bug on website", "description": "There is a bug in the login flow on the website that needs urgent attention. Investigate the root cause, reproduce the issue, and deploy a fix as soon as possible.", "dueDate": null, "projectIndex": null}`,
      },
      {
        role: "user",
        content: "call dentist to make appointment",
      },
      {
        role: "assistant",
        content: `{"title": "Call dentist to make appointment", "description": null, "dueDate": null, "projectIndex": null}`,
      },
      {
        role: "user",
        content: rawInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return { title: rawInput, description: null, dueDate: null, projectId: null };
  }

  const parsed = JSON.parse(content) as {
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    projectIndex?: number | null;
  };

  const projectIndex = parsed.projectIndex ?? null;
  const projectId =
    projects &&
    projectIndex !== null &&
    typeof projectIndex === "number" &&
    projectIndex >= 1 &&
    projectIndex <= projects.length
      ? projects[projectIndex - 1].id
      : null;

  return {
    title: parsed.title || rawInput,
    description: parsed.description || null,
    dueDate: parsed.dueDate || null,
    projectId,
  };
}
```

- [ ] **Step 5: Run all tests to confirm they pass**

```bash
npx vitest run src/lib/ai.test.ts
```

Expected: all 17 tests PASS (11 existing + 6 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts
git commit -m "feat: add project matching to enrichTask"
```

---

### Task 2: Update `createTask` — fetch projects and save `projectId`

**Files:**
- Modify: `src/actions/tasks.ts`
- Modify: `src/actions/tasks.test.ts`

- [ ] **Step 1: Add `getActiveProjects` mock and update existing mocks in `src/actions/tasks.test.ts`**

**Add the mock** at the top of the file alongside the other `vi.mock` calls (after the `vi.mock("@/lib/ai", ...)` block):

```ts
vi.mock("@/actions/projects", () => ({
  getActiveProjects: vi.fn(),
}));
```

**Add the import** alongside the other imports from actions:

```ts
import { getActiveProjects } from "@/actions/projects";
```

**Add `getActiveProjects` to the `beforeEach` in `describe("createTask")`** — return an empty array by default so existing tests are unaffected:

```ts
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveProjects).mockResolvedValue([] as never);
  });
```

**Update all `enrichTask` mock return values** in `describe("createTask")` tests to include `projectId: null` (required now that `EnrichmentResult` includes it):

In "creates a task with AI-enriched fields":
```ts
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Buy groceries",
      description: "Get milk and eggs",
      dueDate: "2026-04-05",
      projectId: null,
    });
```

In "calculates sortOrder 0 when no existing tasks":
```ts
    vi.mocked(enrichTask).mockResolvedValue({
      title: "Test",
      description: null,
      dueDate: null,
      projectId: null,
    });
```

In "handles null dueDate from enrichment":
```ts
    vi.mocked(enrichTask).mockResolvedValue({
      title: "No date task",
      description: null,
      dueDate: null,
      projectId: null,
    });
```

**Update `db.task.create` assertions** in the two tests that use exact `data` objects to include `projectId: null`:

In "creates a task with AI-enriched fields":
```ts
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
```

In "falls back to rawInput when enrichTask throws":
```ts
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
```

- [ ] **Step 2: Write the new failing tests — append to `describe("createTask")` in `src/actions/tasks.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests to confirm new tests and updated assertions fail**

```bash
npx vitest run src/actions/tasks.test.ts
```

Expected: several FAIL — the three new tests plus any existing assertions not yet updated.

- [ ] **Step 4: Update `src/actions/tasks.ts`**

Replace the full `createTask` function (lines 8–42) with:

```ts
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
```

Also add the import for `getActiveProjects` at the top of the file:

```ts
import { getActiveProjects } from "@/actions/projects";
```

- [ ] **Step 5: Run all tests to confirm they pass**

```bash
npx vitest run
```

Expected: all 48 tests pass (45 existing + 3 new).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/actions/tasks.ts src/actions/tasks.test.ts
git commit -m "feat: fetch projects and pass to enrichTask for auto project assignment"
```
