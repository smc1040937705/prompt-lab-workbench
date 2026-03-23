import type { TaskFilter, TaskItem, TaskPriority, TaskStats, TaskStatus } from "@/types/task";
import { diffInDays, formatDate, isOverdue } from "./date";
import { calculateTaskRisk } from "./workflow";

const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

const STATUS_RANK: Record<TaskStatus, number> = {
  todo: 1,
  in_progress: 2,
  review: 3,
  blocked: 4,
  done: 5
};

function defaultTaskId(): string {
  return `task_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeTask(
  input: Partial<TaskItem>,
  fallback: Partial<TaskItem> = {}
): TaskItem {
  const merged = { ...fallback, ...input };
  const now = formatDate(new Date());

  return {
    id: merged.id ?? defaultTaskId(),
    title: merged.title?.trim() || "Untitled Task",
    description: merged.description?.trim() || "",
    priority: merged.priority ?? "medium",
    status: merged.status ?? "todo",
    assignee: merged.assignee?.trim() || "Unassigned",
    dueDate: merged.dueDate ?? now,
    createdAt: merged.createdAt ?? now,
    updatedAt: merged.updatedAt ?? now,
    tags: Array.isArray(merged.tags) ? [...new Set(merged.tags.filter(Boolean))] : [],
    estimateHours: Math.max(0, merged.estimateHours ?? 0),
    actualHours: Math.max(0, merged.actualHours ?? 0),
    blockedReason: merged.blockedReason?.trim() || "",
    reviewer: merged.reviewer?.trim() || undefined,
    dependencies: Array.isArray(merged.dependencies)
      ? [...new Set(merged.dependencies.filter(Boolean))]
      : [],
    sprint: merged.sprint?.trim() || undefined,
    archived: Boolean(merged.archived)
  };
}

export function comparePriority(a: TaskPriority, b: TaskPriority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b];
}

export type TaskSortKey =
  | "priority"
  | "dueDate"
  | "status"
  | "title"
  | "risk"
  | "updatedAt";

export function sortTasks(tasks: TaskItem[], key: TaskSortKey = "priority"): TaskItem[] {
  return [...tasks].sort((left, right) => {
    if (key === "priority") {
      return -comparePriority(left.priority, right.priority);
    }
    if (key === "dueDate") {
      return diffInDays(right.dueDate, left.dueDate);
    }
    if (key === "status") {
      return STATUS_RANK[left.status] - STATUS_RANK[right.status];
    }
    if (key === "risk") {
      return calculateTaskRisk(right).score - calculateTaskRisk(left).score;
    }
    if (key === "updatedAt") {
      return diffInDays(right.updatedAt, left.updatedAt);
    }
    return left.title.localeCompare(right.title, "en");
  });
}

export function filterTasks(tasks: TaskItem[], filter: TaskFilter): TaskItem[] {
  const keyword = filter.keyword?.trim().toLowerCase();
  return tasks.filter((task) => {
    if (!filter.includeArchived && task.archived) {
      return false;
    }
    if (filter.status && filter.status !== "all" && task.status !== filter.status) {
      return false;
    }
    if (filter.priority && filter.priority !== "all" && task.priority !== filter.priority) {
      return false;
    }
    if (filter.assignee && task.assignee !== filter.assignee) {
      return false;
    }
    if (filter.sprint && task.sprint !== filter.sprint) {
      return false;
    }
    if (filter.overdueOnly && !isOverdue(task.dueDate)) {
      return false;
    }
    if (keyword) {
      const haystack = `${task.title} ${task.description} ${task.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }
    return true;
  });
}

export function groupByStatus(tasks: TaskItem[]): Record<TaskStatus, TaskItem[]> {
  return tasks.reduce<Record<TaskStatus, TaskItem[]>>(
    (acc, task) => {
      acc[task.status].push(task);
      return acc;
    },
    {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: []
    }
  );
}

export function calculateTaskStats(tasks: TaskItem[], today = new Date()): TaskStats {
  const activeTasks = tasks.filter((task) => !task.archived);
  const doneTasks = activeTasks.filter((task) => task.status === "done");
  const reviewTasks = activeTasks.filter((task) => task.status === "review");
  const blockedTasks = activeTasks.filter((task) => task.status === "blocked");
  const overdueTasks = activeTasks.filter(
    (task) => task.status !== "done" && isOverdue(task.dueDate, today)
  );
  const archivedTasks = tasks.filter((task) => task.archived);

  return {
    total: activeTasks.length,
    done: doneTasks.length,
    review: reviewTasks.length,
    blocked: blockedTasks.length,
    overdue: overdueTasks.length,
    archived: archivedTasks.length,
    progress:
      activeTasks.length === 0
        ? 0
        : Math.round((doneTasks.length / activeTasks.length) * 100)
  };
}

export function pickNextActionableTask(tasks: TaskItem[]): TaskItem | undefined {
  const actionable = tasks.filter((task) => !task.archived && task.status !== "done");
  const sorted = sortTasks(actionable, "risk");
  return sorted[0];
}

export function collectTags(tasks: TaskItem[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) =>
    a.localeCompare(b, "en")
  );
}

export function estimateWorkloadByAssignee(tasks: TaskItem[]): Record<string, number> {
  return tasks
    .filter((task) => !task.archived && task.status !== "done")
    .reduce<Record<string, number>>((acc, task) => {
      const remaining = Math.max(task.estimateHours - task.actualHours, 0);
      acc[task.assignee] = (acc[task.assignee] ?? 0) + remaining;
      return acc;
    }, {});
}

export function validateDependencies(tasks: TaskItem[]): {
  missing: Array<{ taskId: string; dependencyId: string }>;
  circular: string[][];
} {
  const ids = new Set(tasks.map((task) => task.id));
  const missing: Array<{ taskId: string; dependencyId: string }> = [];
  const adjacency = new Map<string, string[]>();

  tasks.forEach((task) => {
    adjacency.set(task.id, task.dependencies);
    task.dependencies.forEach((dep) => {
      if (!ids.has(dep)) {
        missing.push({ taskId: task.id, dependencyId: dep });
      }
    });
  });

  const circular: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const index = path.indexOf(node);
      circular.push(path.slice(index));
      return;
    }
    if (visited.has(node)) {
      return;
    }
    visited.add(node);
    stack.add(node);
    const nextNodes = adjacency.get(node) ?? [];
    nextNodes.forEach((next) => dfs(next, [...path, next]));
    stack.delete(node);
  }

  tasks.forEach((task) => dfs(task.id, [task.id]));

  return {
    missing,
    circular
  };
}

export function mergeTaskPatch(task: TaskItem, patch: Partial<TaskItem>): TaskItem {
  return normalizeTask(
    {
      ...task,
      ...patch,
      updatedAt: formatDate(new Date())
    },
    task
  );
}
