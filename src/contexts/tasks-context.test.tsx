import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TasksProvider, useTasks } from "./tasks-context";
import { useState } from "react";

describe("TasksContext", () => {
  describe("useTasks", () => {
    it("throws error when used outside TasksProvider", () => {
      function TestComponent() {
        useTasks();
        return <div>Test</div>;
      }

      expect(() => render(<TestComponent />)).toThrow(
        "useTasks must be used within TasksProvider"
      );
    });

    it("provides tasks and setTasks when used inside TasksProvider", () => {
      function TestComponent() {
        const { tasks, setTasks } = useTasks();
        return (
          <div>
            <span data-testid="tasks-count">{tasks.length}</span>
            <button
              data-testid="set-tasks-btn"
              onClick={() =>
                setTasks([
                  {
                    id: "1",
                    title: "Test Task",
                    rawInput: "test",
                    description: null,
                    section: "INBOX",
                    sortOrder: 0,
                    dueDate: null,
                    completedAt: null,
                    scheduledDate: null,
                    waitingFor: null,
                    projectId: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    project: null,
                  },
                ])
              }
            >
              Add Task
            </button>
          </div>
        );
      }

      const { getByTestId } = render(
        <TasksProvider>
          <TestComponent />
        </TasksProvider>
      );

      expect(getByTestId("tasks-count").textContent).toBe("0");
      expect(getByTestId("set-tasks-btn")).toBeDefined();
    });

    it("updates tasks when setTasks is called", () => {
      function TestComponent() {
        const { tasks, setTasks } = useTasks();
        const [updateCount, setUpdateCount] = useState(0);

        const addTask = () => {
          setTasks([
            {
              id: "1",
              title: "Test Task",
              rawInput: "test",
              description: null,
              section: "INBOX",
              sortOrder: 0,
              dueDate: null,
              completedAt: null,
              scheduledDate: null,
              waitingFor: null,
              projectId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              project: null,
            },
          ]);
          setUpdateCount((prev) => prev + 1);
        };

        return (
          <div>
            <span data-testid="tasks-count">{tasks.length}</span>
            <span data-testid="update-count">{updateCount}</span>
            <button data-testid="add-task-btn" onClick={addTask}>
              Add Task
            </button>
          </div>
        );
      }

      const { getByTestId } = render(
        <TasksProvider>
          <TestComponent />
        </TasksProvider>
      );

      expect(getByTestId("tasks-count").textContent).toBe("0");
      expect(getByTestId("update-count").textContent).toBe("0");

      act(() => {
        getByTestId("add-task-btn").click();
      });

      expect(getByTestId("tasks-count").textContent).toBe("1");
      expect(getByTestId("update-count").textContent).toBe("1");
    });

    it("propagates state updates to multiple consumers", () => {
      function Consumer1() {
        const { tasks } = useTasks();
        return <span data-testid="consumer1-count">{tasks.length}</span>;
      }

      function Consumer2() {
        const { tasks } = useTasks();
        return <span data-testid="consumer2-count">{tasks.length}</span>;
      }

      function Producer() {
        const { setTasks } = useTasks();
        return (
          <button
            data-testid="add-task-btn"
            onClick={() =>
              setTasks([
                {
                  id: "1",
                  title: "Test Task",
                  rawInput: "test",
                  description: null,
                  section: "INBOX",
                  sortOrder: 0,
                  dueDate: null,
                  completedAt: null,
                  scheduledDate: null,
                  waitingFor: null,
                  projectId: null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  project: null,
                },
              ])
            }
          >
            Add
          </button>
        );
      }

      const { getByTestId } = render(
        <TasksProvider>
          <Consumer1 />
          <Consumer2 />
          <Producer />
        </TasksProvider>
      );

      expect(getByTestId("consumer1-count").textContent).toBe("0");
      expect(getByTestId("consumer2-count").textContent).toBe("0");

      act(() => {
        getByTestId("add-task-btn").click();
      });

      expect(getByTestId("consumer1-count").textContent).toBe("1");
      expect(getByTestId("consumer2-count").textContent).toBe("1");
    });
  });

  describe("TasksProvider", () => {
    it("renders children correctly", () => {
      render(
        <TasksProvider>
          <div data-testid="child">Child Content</div>
        </TasksProvider>
      );

      expect(screen.getByTestId("child").textContent).toBe("Child Content");
    });

    it("initializes with empty tasks array", () => {
      function TestComponent() {
        const { tasks } = useTasks();
        return <span data-testid="initial-count">{tasks.length}</span>;
      }

      const { getByTestId } = render(
        <TasksProvider>
          <TestComponent />
        </TasksProvider>
      );

      expect(getByTestId("initial-count").textContent).toBe("0");
    });
  });
});
