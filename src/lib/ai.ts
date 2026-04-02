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

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are a task assistant for a GTD app. Today is ${today}. Respond with json only.`,
      },
      {
        role: "user",
        content: "boodschappen doen voor vrijdag melk eieren brood",
      },
      {
        role: "assistant",
        content: `{"title": "Boodschappen doen voor vrijdag", "description": "Ga naar de winkel en koop de volgende items: melk, eieren en brood. Zorg dat dit voor vrijdag gebeurt.", "dueDate": "${today}"}`,
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
