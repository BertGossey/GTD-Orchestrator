"use client";

import { useEffect } from "react";
import { useTasks } from "@/contexts/tasks-context";
import { TaskList } from "@/components/gtd/task-list";
import type { TaskWithProject } from "@/types/gtd";

export function TaskListWithProvider({
  tasks,
  projects,
  sectionId,
}: {
  tasks: TaskWithProject[];
  projects: { id: string; title: string }[];
  sectionId: string;
}) {
  const { setTasks } = useTasks();

  useEffect(() => {
    setTasks(tasks);
  }, [tasks, setTasks]);

  return <TaskList tasks={tasks} projects={projects} sectionId={sectionId} />;
}
