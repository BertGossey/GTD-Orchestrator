"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDroppable } from "@dnd-kit/core";
import {
  Inbox,
  CirclePlay,
  Clock,
  CalendarDays,
  CloudSun,
  BookOpen,
  FolderOpen,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { Project } from "@/generated/prisma/client";

type SidebarNavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
  count?: number;
};

const collectItems: SidebarNavItem[] = [
  { label: "Inbox", href: "/inbox", icon: Inbox, section: "INBOX" },
];

const actionItems: SidebarNavItem[] = [
  { label: "Next", href: "/next", icon: CirclePlay, section: "NEXT" },
  { label: "Waiting", href: "/waiting", icon: Clock, section: "WAITING" },
  { label: "Scheduled", href: "/scheduled", icon: CalendarDays, section: "SCHEDULED" },
  { label: "Someday", href: "/someday", icon: CloudSun, section: "SOMEDAY" },
];

const cleanupItems: SidebarNavItem[] = [
  { label: "Logbook", href: "/logbook", icon: BookOpen, section: "LOGBOOK" },
];

function DroppableNavItem({
  item,
  isActive,
}: {
  item: SidebarNavItem;
  isActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sidebar-${item.section}`,
    data: { section: item.section },
  });

  const Icon = item.icon;

  return (
    <Link
      ref={item.section ? setNodeRef : undefined}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        isOver && "ring-2 ring-primary bg-primary/10"
      )}
    >
      <Icon className="size-4" />
      <span className="flex-1">{item.label}</span>
      {item.count !== undefined && item.count > 0 && (
        <Badge variant="secondary" className="text-xs">
          {item.count}
        </Badge>
      )}
    </Link>
  );
}

export function GtdSidebar({
  projects,
  inboxCount,
  onAddProject,
}: {
  projects: Project[];
  inboxCount: number;
  onAddProject: () => void;
}) {
  const pathname = usePathname();

  const collectWithCount = collectItems.map((item) =>
    item.label === "Inbox" ? { ...item, count: inboxCount } : item
  );

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar p-4">
      <div className="mb-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collect
        </p>
        <nav className="space-y-1">
          {collectWithCount.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>

      <Separator className="mb-4" />

      <div className="mb-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </p>
        <nav className="space-y-1">
          {actionItems.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>

      <Separator className="mb-4" />

      <div className="mb-4 flex-1">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </p>
          <Button variant="ghost" size="icon-xs" onClick={onAddProject}>
            <Plus className="size-3" />
          </Button>
        </div>
        <nav className="space-y-1">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === `/projects/${project.id}`
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <FolderOpen className="size-4" />
              <span className="truncate">{project.title}</span>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground">No projects</p>
          )}
        </nav>
      </div>

      <Separator className="mb-4" />

      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cleanup
        </p>
        <nav className="space-y-1">
          {cleanupItems.map((item) => (
            <DroppableNavItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
