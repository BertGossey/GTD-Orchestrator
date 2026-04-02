"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CalendarDays, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTask } from "@/actions/tasks";
import type { TaskWithProject } from "@/types/gtd";

export function TaskDetail({
  task,
  projects,
}: {
  task: TaskWithProject;
  projects: { id: string; title: string }[];
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [waitingFor, setWaitingFor] = useState(task.waitingFor ?? "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined
  );
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    task.scheduledDate ? new Date(task.scheduledDate) : undefined
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    task.projectId
  );
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(overrides?: {
    dueDate?: Date | null;
    scheduledDate?: Date | null;
    projectId?: string | null;
  }) {
    startTransition(async () => {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: description.trim() || null,
        waitingFor: waitingFor.trim() || null,
        dueDate: dueDate ?? null,
        scheduledDate: scheduledDate ?? null,
        projectId: selectedProjectId,
        ...overrides,
      });
    });
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="border-t px-10 py-3 space-y-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => save()}
        placeholder="Title"
        className="font-medium"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => save()}
        placeholder="Description"
        rows={2}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
            <CalendarDays className="size-3.5" />
            {dueDate
              ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Due date"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dueDate}
              onSelect={(date) => {
                setDueDate(date ?? undefined);
                save({ dueDate: date ?? null });
              }}
            />
            {dueDate && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full gap-1" onClick={() => { setDueDate(undefined); save({ dueDate: null }); }}>
                  <X className="size-3" /> Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
            <CalendarDays className="size-3.5" />
            {scheduledDate
              ? scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Scheduled"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={scheduledDate}
              onSelect={(date) => {
                setScheduledDate(date ?? undefined);
                save({ scheduledDate: date ?? null });
              }}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
            {scheduledDate && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full gap-1" onClick={() => { setScheduledDate(undefined); save({ scheduledDate: null }); }}>
                  <X className="size-3" /> Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Input
          value={waitingFor}
          onChange={(e) => setWaitingFor(e.target.value)}
          onBlur={() => save()}
          placeholder="Waiting for..."
          className="h-8 w-48 text-sm"
        />

        <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
          <PopoverTrigger
            role="combobox"
            aria-expanded={projectPopoverOpen}
            className={buttonVariants({ variant: "outline", size: "sm", className: "w-48 justify-between" })}
          >
            {selectedProject ? selectedProject.title : "Select project..."}
            <ChevronsUpDown className="ml-2 size-3.5 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-48 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search projects..." />
              <CommandList>
                <CommandEmpty>No project found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="__none__" onSelect={() => { setSelectedProjectId(null); setProjectPopoverOpen(false); save({ projectId: null }); }}>
                    <Check className={cn("mr-2 size-3.5", selectedProjectId === null ? "opacity-100" : "opacity-0")} />
                    None
                  </CommandItem>
                  {projects.map((project) => (
                    <CommandItem key={project.id} value={project.title} onSelect={() => { setSelectedProjectId(project.id); setProjectPopoverOpen(false); save({ projectId: project.id }); }}>
                      <Check className={cn("mr-2 size-3.5", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                      {project.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {isPending && (
        <p className="text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  );
}
