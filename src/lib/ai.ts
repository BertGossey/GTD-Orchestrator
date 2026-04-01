import { AzureOpenAI } from "openai";

function getClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    apiVersion: "2024-12-01-preview",
    timeout: 10_000,
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
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-5";

  const today = new Date().toISOString().split("T")[0];

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      {
        role: "system",
        content: `You are a task assistant. Given a short sentence describing a task, extract:
- "title": a concise, action-oriented title (max 80 chars)
- "description": an expanded description if the sentence contains extra context, otherwise null
- "dueDate": an ISO date string (YYYY-MM-DD) if a deadline or date is mentioned, otherwise null. Today is ${today}.

Respond with valid JSON only. No markdown, no extra text.`,
      },
      {
        role: "user",
        content: rawInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 200,
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
