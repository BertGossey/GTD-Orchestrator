"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { TaskRow } from "@/components/gtd/task-row";
import type { TaskWithProject } from "@/types/gtd";

export function TaskList({
  tasks,
  projects,
  sectionId,
}: {
  tasks: TaskWithProject[];
  projects: { id: string; title: string }[];
  sectionId: string;
}) {
  const { setNodeRef } = useDroppable({
    id: `list-${sectionId}`,
    data: {
      section: sectionId,
      sortableIds: tasks.map((t) => t.id),
    },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className="space-y-1">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projects={projects} />
        ))}
        {tasks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks
          </p>
        )}
      </div>
    </SortableContext>
  );
}
