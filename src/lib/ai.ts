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

export type ProjectInput = { id: string; title: string; description: string | null };

export async function enrichTask(
  rawInput: string,
  projects?: ProjectInput[]
): Promise<EnrichmentResult> {
  const client = getClient();
  // Use local timezone to avoid date shifts
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Next Friday strictly after today (never today itself, even if today is Friday)
  const dayOfWeek = now.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const fridayDate = new Date(now);
  fridayDate.setDate(now.getDate() + daysUntilFriday);
  const nextFriday = `${fridayDate.getFullYear()}-${String(fridayDate.getMonth() + 1).padStart(2, "0")}-${String(fridayDate.getDate()).padStart(2, "0")}`;

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
