"use client";

import { useState, useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TaskDetail } from "@/components/gtd/task-detail";
import { completeTask } from "@/actions/tasks";
import type { TaskWithProject } from "@/types/gtd";

export function TaskRow({
  task,
  projects,
  isDragOverlay,
}: {
  task: TaskWithProject;
  projects: { id: string; title: string }[];
  isDragOverlay?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isCompleting, startTransition] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      section: task.section,
      scheduledDate: task.scheduledDate,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleCheck() {
    startTransition(async () => {
      await completeTask(task.id);
    });
  }

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={cn(
        "rounded-md border bg-background transition-opacity",
        isDragging && "opacity-50",
        isCompleting && "opacity-50 transition-opacity duration-300"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="size-4" />
        </button>

        <Checkbox
          checked={task.section === "LOGBOOK"}
          onCheckedChange={handleCheck}
          disabled={task.section === "LOGBOOK" || isCompleting}
        />

        <button
          className="flex flex-1 items-center gap-2 text-left text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          <span className={cn(task.section === "LOGBOOK" && "line-through text-muted-foreground")}>
            {task.title}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {task.project && (
            <Badge variant="secondary" className="text-xs">
              {task.project.title}
            </Badge>
          )}
          {formattedDueDate && (
            <Badge variant="outline" className="text-xs">
              Due {formattedDueDate}
            </Badge>
          )}
        </div>
      </div>

      {expanded && (
        <TaskDetail task={task} projects={projects} />
      )}
    </div>
  );
}
