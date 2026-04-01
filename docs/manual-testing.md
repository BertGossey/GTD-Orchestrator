# Manual Testing Plan — GTD Orchestrator

## Prerequisites

1. `.env.local` configured with real Supabase credentials and Azure OpenAI keys
2. `npx prisma db push` run successfully
3. `npm run dev` running on `http://localhost:3000`

---

## 1. Navigation & Layout

| # | Step | Expected Result |
|---|------|-----------------|
| 1.1 | Open `http://localhost:3000` | Redirects to `/inbox` |
| 1.2 | Verify sidebar sections visible | COLLECT (Inbox), ACTIONS (Next, Waiting, Scheduled, Someday), PROJECTS, CLEANUP (Logbook) |
| 1.3 | Click each sidebar item | URL changes, heading in main content matches section name, active item highlighted |
| 1.4 | Verify Rapid Entry bar visible | Input with placeholder "Rapid Entry — type here and hit enter / or esc" at top of main content |
| 1.5 | Resize browser window | Layout stays intact — sidebar fixed, main content scrolls independently |

---

## 2. Rapid Entry & Task Creation

| # | Step | Expected Result |
|---|------|-----------------|
| 2.1 | Click into Rapid Entry, type "Buy groceries by Friday", press Enter | Spinner appears in input, input clears. After a few seconds, task appears in Inbox list with LLM-enriched title |
| 2.2 | Check the created task's title | Should be a clean, action-oriented title (e.g., "Buy groceries") — not the raw sentence |
| 2.3 | Expand the task (click on it) | Inline detail shows: title, description (if LLM generated one), due date (should be set to upcoming Friday) |
| 2.4 | Type "something" and press Escape | Input clears, no task created |
| 2.5 | Press Enter with empty input | Nothing happens (no empty task created) |
| 2.6 | Create several tasks rapidly | Each gets a unique sort order, all appear in Inbox in creation order |

**Without Azure OpenAI configured:**

| # | Step | Expected Result |
|---|------|-----------------|
| 2.7 | Remove `AZURE_OPENAI_API_KEY` from `.env.local`, restart dev server | — |
| 2.8 | Type "test task without AI" and press Enter | Task created with raw input as title, no description, no due date (fallback behavior) |

---

## 3. Task Inline Expand & Editing

| # | Step | Expected Result |
|---|------|-----------------|
| 3.1 | Click a task row in Inbox | Row expands inline showing: title input, description textarea, due date button, scheduled button, "Waiting for..." input, project dropdown |
| 3.2 | Edit the title, click away (blur) | "Saving..." appears briefly, title updates |
| 3.3 | Add a description, click away | Description saved |
| 3.4 | Click "Due date" button | Calendar popover opens |
| 3.5 | Pick a date in the calendar | Date saves, button now shows the selected date (e.g., "Apr 15") |
| 3.6 | Click "Clear" under the due date calendar | Date removed, button reverts to "Due date" |
| 3.7 | Click "Scheduled" button, pick a date | Scheduled date saved |
| 3.8 | Type in "Waiting for..." field, blur | Value saved |
| 3.9 | Click "Select project..." dropdown | Combobox opens with "None" and any existing projects |
| 3.10 | Click the task row again | Inline detail collapses |

---

## 4. Task Completion (Checkbox)

| # | Step | Expected Result |
|---|------|-----------------|
| 4.1 | Check the checkbox on a task in Inbox | Task fades slightly, then disappears from Inbox |
| 4.2 | Navigate to Logbook | Completed task appears with strikethrough title and completion date badge |
| 4.3 | Return to Inbox | Inbox count badge in sidebar has decremented by 1 |

---

## 5. Drag-and-Drop — Within-List Reorder

| # | Step | Expected Result |
|---|------|-----------------|
| 5.1 | Create 3+ tasks in Inbox (e.g., "Task A", "Task B", "Task C") | All three visible in order |
| 5.2 | Grab "Task C" by the grip handle (dots on left) | Cursor changes to grab, drag overlay appears |
| 5.3 | Drag "Task C" above "Task A", release | List reorders to: Task C, Task A, Task B |
| 5.4 | Refresh the page | Order persists (saved to database) |

---

## 6. Drag-and-Drop — Cross-Section Movement

| # | Step | Expected Result |
|---|------|-----------------|
| 6.1 | Grab a task from Inbox | Drag overlay appears |
| 6.2 | Drag over "Next" in the sidebar | "Next" nav item highlights (ring/bg change) |
| 6.3 | Drop on "Next" | Task disappears from Inbox |
| 6.4 | Click "Next" in sidebar | Task appears in the Next list |
| 6.5 | Drag a task from Next to "Waiting" | Task moves to Waiting section |
| 6.6 | Drag a task to "Someday" | Task moves to Someday section |

---

## 7. Drag to Scheduled (Date Picker Trigger)

| # | Step | Expected Result |
|---|------|-----------------|
| 7.1 | Create a task in Inbox with no scheduled date | — |
| 7.2 | Drag the task to "Scheduled" in the sidebar | Date picker dialog appears ("Pick a scheduled date") |
| 7.3 | Try clicking "Schedule" without selecting a date | Button is disabled |
| 7.4 | Select a future date, click "Schedule" | Dialog closes, task moves to Scheduled section |
| 7.5 | Navigate to Scheduled | Task appears, ordered by scheduled date |
| 7.6 | Click "Cancel" in the dialog instead | Dialog closes, task stays in its original section |

**With existing scheduled date:**

| # | Step | Expected Result |
|---|------|-----------------|
| 7.7 | Drag a task that already has a scheduledDate to Scheduled | Task moves immediately — no date picker dialog (it already has a date) |

---

## 8. Stale Field Clearing

| # | Step | Expected Result |
|---|------|-----------------|
| 8.1 | Move a task to Waiting, expand it, set "Waiting for: John" | Value saved |
| 8.2 | Drag the task from Waiting to Next | Task moves to Next |
| 8.3 | Expand the task in Next | "Waiting for..." field is empty (cleared on move) |
| 8.4 | Move a task to Scheduled with a date | — |
| 8.5 | Drag the task from Scheduled to Inbox | Task moves to Inbox |
| 8.6 | Expand the task in Inbox | "Scheduled" field shows no date (cleared on move) |

---

## 9. Projects

| # | Step | Expected Result |
|---|------|-----------------|
| 9.1 | Click "+" button next to "Projects" in sidebar | "New Project" dialog opens |
| 9.2 | Enter title "Home", optional description, click "Create" | Dialog closes, "Home" appears in sidebar under Projects |
| 9.3 | Create another project "Work" | Both projects visible in sidebar |
| 9.4 | Expand a task in any section, click "Select project..." | Combobox shows: None, Home, Work |
| 9.5 | Select "Home" | Project badge "Home" appears on the task row |
| 9.6 | Click "Home" project in sidebar | Project detail page shows: project title, tasks grouped by section |
| 9.7 | Assign multiple tasks to "Home" in different sections | Project detail view groups them correctly under section headings |

---

## 10. Inbox Count Badge

| # | Step | Expected Result |
|---|------|-----------------|
| 10.1 | Note the badge number next to "Inbox" in sidebar | Shows current inbox task count |
| 10.2 | Add a task via Rapid Entry | Badge increments |
| 10.3 | Move a task out of Inbox (drag to Next) | Badge decrements |
| 10.4 | Complete an Inbox task (checkbox) | Badge decrements |
| 10.5 | Empty the inbox completely | Badge disappears (no badge shown for 0) |

---

## 11. Logbook

| # | Step | Expected Result |
|---|------|-----------------|
| 11.1 | Navigate to Logbook with no completed tasks | Shows "No completed tasks" |
| 11.2 | Complete several tasks from different sections | — |
| 11.3 | Navigate to Logbook | All completed tasks shown, most recent first |
| 11.4 | Verify each row shows | Strikethrough title, completion date badge, project badge (if assigned) |
| 11.5 | Verify no drag handles or checkboxes | Logbook is read-only |

---

## 12. Edge Cases

| # | Step | Expected Result |
|---|------|-----------------|
| 12.1 | Create a task with very long text (200+ chars) | Task created, title truncated/reasonable, no UI overflow |
| 12.2 | Create a task with special characters (`<script>`, `"quotes"`, emoji) | Task created safely, no XSS, characters displayed correctly |
| 12.3 | Rapidly click the checkbox on a task multiple times | Only one completion occurs, no errors |
| 12.4 | Drag a task and drop it nowhere (release outside sidebar/list) | Task returns to original position, no error |
| 12.5 | Open the app in two browser tabs, create a task in one | Refresh the other tab — task appears (server-rendered data) |

---

## Test Result Template

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1.1  |           |       |
| 1.2  |           |       |
| ...  |           |       |
