"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { TaskWithProject } from "@/types/gtd";

type TasksContextType = {
  tasks: TaskWithProject[];
  setTasks: (tasks: TaskWithProject[]) => void;
};

const TasksContext = createContext<TasksContextType | null>(null);

/**
 * Provider component that manages task state for drag-and-drop operations.
 * Wrap this around components that need access to the shared task list.
 *
 * @example
 * ```tsx
 * <TasksProvider>
 *   <TaskList />
 * </TasksProvider>
 * ```
 */
export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);

  const value = useMemo(() => ({ tasks, setTasks }), [tasks]);

  return (
    <TasksContext.Provider value={value}>
      {children}
    </TasksContext.Provider>
  );
}

/**
 * Hook to access the tasks context.
 * Must be used within a TasksProvider component.
 *
 * @throws {Error} If used outside of TasksProvider
 * @returns {TasksContextType} The tasks state and setter function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { tasks, setTasks } = useTasks();
 *   // ... use tasks
 * }
 * ```
 */
export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return context;
}
