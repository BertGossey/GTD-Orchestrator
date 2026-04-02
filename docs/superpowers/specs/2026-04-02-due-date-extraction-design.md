# Due Date Extraction — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Summary

Improve the LLM task enrichment to reliably extract due dates from user input. The LLM already returns a `dueDate` field but the current system prompt gives it no rules, leading to inconsistent behaviour. This change updates the system prompt and few-shot examples in `src/lib/ai.ts` to enforce 5 explicit rules.

## Rules

1. Only set `dueDate` if the user explicitly mentions a date, day, or timeframe (e.g., "by Friday", "next week", "in 3 days")
2. Resolve relative dates based on today (`${today}` injected at call time)
3. No timeframe mentioned → `null`
4. Vague urgency only ("asap", "urgent", "soon") → `null`
5. Resolved date would be in the past → `null`

## Changes

### `src/lib/ai.ts`

**System prompt** — replace the current minimal prompt with one that includes all 5 rules:

```
You are a task assistant for a GTD app. Today is ${today}. Respond with JSON only.
Given a task description, extract:
- "title": concise, action-oriented title (max 80 chars)
- "description": expanded context from the input, or null if nothing to add
- "dueDate": ISO date string (YYYY-MM-DD), following these rules:
  1. Only set if the user explicitly mentions a date, day, or timeframe
  2. Resolve relative dates based on today (${today})
  3. If no timeframe is mentioned, set to null
  4. If the timeframe is vague urgency only ("asap", "urgent", "soon"), set to null
  5. If the resolved date is in the past, set to null
```

**Next Friday calculation** — computed alongside `today` for use in the first few-shot example:

```ts
const todayDate = new Date();
const daysUntilFriday = (5 - todayDate.getDay() + 7) % 7 || 7;
const fridayDate = new Date(todayDate);
fridayDate.setDate(todayDate.getDate() + daysUntilFriday);
const nextFriday = fridayDate.toISOString().split("T")[0];
```

**Few-shot examples** — three examples replacing the current two:

| Input | dueDate | Rule demonstrated |
|---|---|---|
| "boodschappen doen voor vrijdag melk eieren brood" | `nextFriday` (computed) | Rule 2: resolve relative date |
| "need to fix the login bug on the website asap" | `null` | Rule 4: vague urgency |
| "call dentist to make appointment" | `null` | Rule 3: no timeframe |

The first example previously used `today` as the due date (incorrect — "voor vrijdag" means "before Friday"). This is fixed to `nextFriday`.

### `src/lib/ai.test.ts`

Add two tests to the existing `describe("enrichTask")` block:

1. **System prompt contains due date rules** — verify the system prompt includes the key rule phrases: "past", "asap", "urgent", "soon"
2. **System prompt contains the date rules header** — verify "dueDate" rules are present in the prompt

No changes to `EnrichmentResult` type, parsing logic, or return handling — those are unchanged.

## Constraints

- No new dependencies
- No changes to `src/actions/tasks.ts` — it already handles `dueDate` correctly
- `EnrichmentResult.dueDate` type (`string | null`) is unchanged
- The `nextFriday` calculation always returns the Friday strictly after today (never today itself, even if today is Friday)
