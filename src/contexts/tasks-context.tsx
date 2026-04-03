"use client";

import { createContext, useContext, useState } from "react";
import type { TaskWithProject } from "@/types/gtd";

type TasksContextType = {
  tasks: TaskWithProject[];
  setTasks: (tasks: TaskWithProject[]) => void;
};

const TasksContext = createContext<TasksContextType | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);

  return (
    <TasksContext.Provider value={{ tasks, setTasks }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return context;
}
