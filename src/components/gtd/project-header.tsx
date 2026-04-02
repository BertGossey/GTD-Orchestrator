"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { updateProject, deleteProject } from "@/actions/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ProjectHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  const [titleValue, setTitleValue] = useState(title);
  const [descriptionValue, setDescriptionValue] = useState(description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();

  function save() {
    startTransition(async () => {
      await updateProject(id, {
        title: titleValue.trim() || title,
        description: descriptionValue.trim() || null,
      });
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProject(id);
      router.push("/");
    });
  }

  return (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <Input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={() => save()}
            className="mb-1 border-transparent bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:border-input focus-visible:bg-background focus-visible:px-3 transition-all"
          />
          {editingDescription ? (
            <textarea
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={() => {
                setEditingDescription(false);
                save();
              }}
              autoFocus
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <p
              onClick={() => setEditingDescription(true)}
              className="cursor-text text-sm text-muted-foreground"
            >
              {descriptionValue || (
                <span className="italic">Add a description...</span>
              )}
            </p>
          )}
          {isPending && (
            <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? Tasks in this project will lose their project
              association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
