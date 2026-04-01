"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { createTask } from "@/actions/tasks";

export function RapidEntry() {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      const input = value.trim();
      setValue("");
      startTransition(async () => {
        await createTask(input);
      });
    }
    if (e.key === "Escape") {
      setValue("");
    }
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Rapid Entry \u2014 type here and hit enter / or esc"
        disabled={isPending}
        className="h-10 pr-10"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-2.5 size-5 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
