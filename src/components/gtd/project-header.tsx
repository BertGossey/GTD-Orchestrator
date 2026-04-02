"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { updateProject } from "@/actions/projects";

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

  function save() {
    startTransition(async () => {
      await updateProject(id, {
        title: titleValue.trim() || title,
        description: descriptionValue.trim() || null,
      });
    });
  }

  return (
    <div className="mb-4">
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
          onBlur={() => { setEditingDescription(false); save(); }}
          autoFocus
          rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <p
          onClick={() => setEditingDescription(true)}
          className="cursor-text text-sm text-muted-foreground"
        >
          {descriptionValue || <span className="italic">Add a description...</span>}
        </p>
      )}
      {isPending && (
        <p className="mt-1 text-xs text-muted-foreground">Saving...</p>
      )}
    </div>
  );
}
