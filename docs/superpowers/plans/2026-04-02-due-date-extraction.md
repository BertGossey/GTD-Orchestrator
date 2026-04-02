# Due Date Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the LLM system prompt and few-shot examples in `enrichTask` so due dates are only set when the user explicitly mentions a timeframe, with correct relative date resolution.

**Architecture:** Pure prompt engineering change in `src/lib/ai.ts` — update the system prompt to include 5 explicit dueDate rules, compute `nextFriday` alongside `today`, fix the first few-shot example (currently uses wrong `today` date for a Friday deadline), and add a third no-timeframe example. Two new tests in `ai.test.ts` verify the rules are encoded in the prompt.

**Tech Stack:** Azure OpenAI SDK, Vitest

---

### Task 1: Add tests for due date rules, then update system prompt and examples

**Files:**
- Modify: `src/lib/ai.test.ts`
- Modify: `src/lib/ai.ts`

- [ ] **Step 1: Write the two failing tests**

Append these two tests inside the existing `describe("enrichTask", () => { ... })` block at the end of `src/lib/ai.test.ts`, before the closing `});`:

```ts
  it("system prompt includes due date rules for vague urgency and past dates", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Test",
              description: null,
              dueDate: null,
            }),
          },
        },
      ],
    });

    await enrichTask("test");

    const systemPrompt = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("past");
    expect(systemPrompt).toContain("asap");
    expect(systemPrompt).toContain("urgent");
    expect(systemPrompt).toContain("soon");
  });

  it("first few-shot assistant example uses a future Friday date, not today", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Test",
              description: null,
              dueDate: null,
            }),
          },
        },
      ],
    });

    await enrichTask("test");

    const messages = mockCreate.mock.calls[0][0].messages as Array<{
      role: string;
      content: string;
    }>;
    const firstAssistantMsg = messages.find((m) => m.role === "assistant")!;
    const parsed = JSON.parse(firstAssistantMsg.content);
    const today = new Date().toISOString().split("T")[0];
    // The first assistant example is for a Friday deadline — must be a future date, never today
    expect(parsed.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.dueDate > today).toBe(true);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/ai.test.ts
```

Expected: 2 FAIL — current prompt has no "past"/"asap"/"urgent"/"soon", and first example uses `today` not a future Friday.

- [ ] **Step 3: Replace `src/lib/ai.ts` with the updated implementation**

Replace the full contents of `src/lib/ai.ts` with:

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
};

export async function enrichTask(
  rawInput: string
): Promise<EnrichmentResult> {
  const client = getClient();
  const today = new Date().toISOString().split("T")[0];

  // Next Friday strictly after today (never today itself, even if today is Friday)
  const todayDate = new Date();
  const daysUntilFriday = (5 - todayDate.getDay() + 7) % 7 || 7;
  const fridayDate = new Date(todayDate);
  fridayDate.setDate(todayDate.getDate() + daysUntilFriday);
  const nextFriday = fridayDate.toISOString().split("T")[0];

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
  5. If the resolved date is in the past, set to null`,
      },
      {
        role: "user",
        content: "boodschappen doen voor vrijdag melk eieren brood",
      },
      {
        role: "assistant",
        content: `{"title": "Boodschappen doen voor vrijdag", "description": "Ga naar de winkel en koop de volgende items: melk, eieren en brood. Zorg dat dit voor vrijdag gebeurt.", "dueDate": "${nextFriday}"}`,
      },
      {
        role: "user",
        content: "need to fix the login bug on the website asap",
      },
      {
        role: "assistant",
        content: `{"title": "Fix login bug on website", "description": "There is a bug in the login flow on the website that needs urgent attention. Investigate the root cause, reproduce the issue, and deploy a fix as soon as possible.", "dueDate": null}`,
      },
      {
        role: "user",
        content: "call dentist to make appointment",
      },
      {
        role: "assistant",
        content: `{"title": "Call dentist to make appointment", "description": null, "dueDate": null}`,
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
    return { title: rawInput, description: null, dueDate: null };
  }

  const parsed = JSON.parse(content) as EnrichmentResult;
  return {
    title: parsed.title || rawInput,
    description: parsed.description || null,
    dueDate: parsed.dueDate || null,
  };
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npx vitest run
```

Expected: all 45 tests pass (43 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/ai.test.ts
git commit -m "feat: add due date extraction rules to LLM system prompt"
```
