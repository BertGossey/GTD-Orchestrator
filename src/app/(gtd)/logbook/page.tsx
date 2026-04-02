import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { deleteTask } from "@/actions/tasks";

export default async function LogbookPage() {
  const tasks = await db.task.findMany({
    where: { section: "LOGBOOK" },
    orderBy: { completedAt: "desc" },
    include: { project: true },
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Logbook</h1>
      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No completed tasks
        </p>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-md border px-4 py-2"
            >
              <span className="flex-1 text-sm line-through text-muted-foreground">
                {task.title}
              </span>
              <div className="flex items-center gap-1.5">
                {task.project && (
                  <Badge variant="secondary" className="text-xs">
                    {task.project.title}
                  </Badge>
                )}
                {task.completedAt && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(task.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Badge>
                )}
                <form action={deleteTask.bind(null, task.id)}>
                  <button
                    type="submit"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete task"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
