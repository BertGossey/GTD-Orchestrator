import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    AzureOpenAI: class {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

import { enrichTask } from "./ai";

describe("enrichTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AZURE_OPENAI_ENDPOINT = "https://test.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "gpt-5";
  });

  it("returns enriched task with all fields", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Buy groceries",
              description: "Get milk, eggs, and bread from the store",
              dueDate: "2026-04-05",
            }),
          },
        },
      ],
    });

    const result = await enrichTask("buy groceries tomorrow");

    expect(result).toEqual({
      title: "Buy groceries",
      description: "Get milk, eggs, and bread from the store",
      dueDate: "2026-04-05",
    });
  });

  it("returns null description when LLM returns empty string", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Fix bug",
              description: "",
              dueDate: null,
            }),
          },
        },
      ],
    });

    const result = await enrichTask("fix the bug");

    expect(result.description).toBeNull();
    expect(result.dueDate).toBeNull();
  });

  it("returns rawInput as title when LLM returns empty title", async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "",
              description: null,
              dueDate: null,
            }),
          },
        },
      ],
    });

    const result = await enrichTask("my task");

    expect(result.title).toBe("my task");
  });

  it("returns fallback when response has no choices", async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await enrichTask("some task");

    expect(result).toEqual({
      title: "some task",
      description: null,
      dueDate: null,
    });
  });

  it("returns fallback when message content is null", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await enrichTask("another task");

    expect(result).toEqual({
      title: "another task",
      description: null,
      dueDate: null,
    });
  });

  it("throws when LLM returns invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not json" } }],
    });

    await expect(enrichTask("broken")).rejects.toThrow();
  });

  it("includes today's date in the system prompt", async () => {
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

    await enrichTask("test task");

    const today = new Date().toISOString().split("T")[0];
    const systemMessage = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMessage.content).toContain(`Today is ${today}`);
  });

  it("uses AZURE_OPENAI_DEPLOYMENT env var as model", async () => {
    process.env.AZURE_OPENAI_DEPLOYMENT = "custom-deployment";

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

    expect(mockCreate.mock.calls[0][0].model).toBe("custom-deployment");
  });

  it("passes rawInput as the last user message", async () => {
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

    await enrichTask("buy milk by Friday");

    const messages = mockCreate.mock.calls[0][0].messages;
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage).toEqual({ role: "user", content: "buy milk by Friday" });
  });
});
