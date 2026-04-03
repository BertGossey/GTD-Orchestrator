"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useTasks } from "@/contexts/tasks-context";
import { GtdSidebar } from "@/components/gtd/sidebar";
import { RapidEntry } from "@/components/gtd/rapid-entry";
import { ProjectFormDialog } from "@/components/gtd/project-form";
import { ScheduledDateDialog } from "@/components/gtd/scheduled-date-dialog";
import { moveTask, reorderTasks, reorderScheduledTasks, extractDateKey } from "@/actions/tasks";
import type { Project, TaskSection } from "@/generated/prisma/client";

export function GtdLayoutClient({
  projects,
  inboxCount,
  sectionCounts,
  projectCounts,
  children,
}: {
  projects: Project[];
  inboxCount: number;
  sectionCounts: { next: number; waiting: number; scheduled: number; someday: number };
  projectCounts: Record<string, number>;
  children: React.ReactNode;
}) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [scheduledDialog, setScheduledDialog] = useState<{
    taskId: string;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { tasks } = useTasks();

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Cross-section drop (onto sidebar)
      if (over.id.toString().startsWith("sidebar-") && overData?.section) {
        const targetSection = overData.section as TaskSection;
        const taskId = active.id as string;

        if (
          targetSection === "SCHEDULED" &&
          activeData?.scheduledDate == null
        ) {
          setScheduledDialog({ taskId });
          return;
        }

        await moveTask(taskId, targetSection);
        return;
      }

      // SCHEDULED section handling - within-day and cross-day
      if (
        activeData?.section === "SCHEDULED" &&
        overData?.section === "SCHEDULED"
      ) {
        const activeDateKey = activeData.dateKey;
        const overDateKey = overData.dateKey;

        if (!activeDateKey || !overDateKey) return;

        // Within-day reorder (same date)
        if (activeDateKey === overDateKey) {
          const dayTasks = tasks.filter(
            (t) =>
              t.scheduledDate && extractDateKey(t.scheduledDate) === activeDateKey
          );
          const taskIds = dayTasks.map((t) => t.id);
          const oldIndex = taskIds.indexOf(active.id as string);
          const newIndex = taskIds.indexOf(over.id as string);

          if (oldIndex === -1 || newIndex === -1) return;
          if (oldIndex === newIndex) return;

          await reorderScheduledTasks(
            active.id as string,
            activeDateKey,
            newIndex,
            true // sameDayMove
          );
          return;
        }

        // Cross-day move (different dates)
        if (activeDateKey !== overDateKey) {
          const targetDayTasks = tasks.filter(
            (t) =>
              t.scheduledDate && extractDateKey(t.scheduledDate) === overDateKey
          );
          const newIndex = targetDayTasks.findIndex((t) => t.id === over.id);
          const insertIndex = newIndex !== -1 ? newIndex : targetDayTasks.length;

          await reorderScheduledTasks(
            active.id as string,
            overDateKey,
            insertIndex,
            false // sameDayMove
          );
          return;
        }
      }

      // Within-list reorder
      if (overData?.sortableIds && activeData?.section === overData?.section) {
        const ids = overData.sortableIds as string[];
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = arrayMove(ids, oldIndex, newIndex);
          await reorderTasks(activeData!.section as TaskSection, newOrder);
        }
        return;
      }

      // Within-section reorder (non-SCHEDULED sections)
      if (
        activeData?.section &&
        overData?.section &&
        activeData.section === overData.section &&
        activeData.section !== "SCHEDULED"
      ) {
        const section = activeData.section as TaskSection;

        // Get current task IDs for this section
        const sectionTasks = tasks.filter((t) => t.section === section);
        const taskIds = sectionTasks.map((t) => t.id);

        const oldIndex = taskIds.indexOf(active.id as string);
        const newIndex = taskIds.indexOf(over.id as string);

        // If dropped on self, nothing to do
        if (oldIndex === newIndex) return;

        // Both indices must be valid
        if (oldIndex === -1 || newIndex === -1) return;

        // Compute new order
        const newOrder = arrayMove(taskIds, oldIndex, newIndex);

        // Persist to database
        await reorderTasks(section, newOrder);
        return;
      }
    },
    [tasks]
  );

  const handleScheduledConfirm = useCallback(
    async (date: Date) => {
      if (scheduledDialog) {
        await moveTask(scheduledDialog.taskId, "SCHEDULED", date);
        setScheduledDialog(null);
      }
    },
    [scheduledDialog]
  );

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen overflow-hidden">
        <GtdSidebar
          projects={projects}
          inboxCount={inboxCount}
          sectionCounts={sectionCounts}
          projectCounts={projectCounts}
          onAddProject={() => setProjectDialogOpen(true)}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b bg-background px-6 py-3">
            <RapidEntry />
          </div>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>

      <ProjectFormDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
      />
      <ScheduledDateDialog
        open={scheduledDialog !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setScheduledDialog(null);
        }}
        onConfirm={handleScheduledConfirm}
      />
      <DragOverlay>
        {activeId ? (
          <div className="rounded-md border bg-background px-4 py-2 shadow-lg">
            Dragging...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
