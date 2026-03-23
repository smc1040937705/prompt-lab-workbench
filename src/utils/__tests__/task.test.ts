import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskItem, TaskFilter, TaskStatus } from "@/types/task";
import {
  normalizeTask,
  comparePriority,
  sortTasks,
  filterTasks,
  groupByStatus,
  calculateTaskStats,
  pickNextActionableTask,
  collectTags,
  estimateWorkloadByAssignee,
  validateDependencies,
  mergeTaskPatch
} from "@/utils/task";

describe("normalizeTask", () => {
  const baseDate = "2026-03-23";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(baseDate));
  });

  it("should create task with defaults", () => {
    const task = normalizeTask({ title: "Test Task" });

    expect(task.title).toBe("Test Task");
    expect(task.id).toMatch(/^task_[a-z0-9]+$/);
    expect(task.priority).toBe("medium");
    expect(task.status).toBe("todo");
    expect(task.assignee).toBe("Unassigned");
    expect(task.tags).toEqual([]);
    expect(task.dependencies).toEqual([]);
    expect(task.archived).toBe(false);
    expect(task.estimateHours).toBe(0);
    expect(task.actualHours).toBe(0);
  });

  it("should trim string fields", () => {
    const task = normalizeTask({
      title: "  Test Task  ",
      description: "  Description  ",
      assignee: "  John  ",
      blockedReason: "  Blocked  "
    });

    expect(task.title).toBe("Test Task");
    expect(task.description).toBe("Description");
    expect(task.assignee).toBe("John");
    expect(task.blockedReason).toBe("Blocked");
  });

  it("should use fallback values", () => {
    const fallback = { priority: "high" as const, assignee: "Default" };
    const task = normalizeTask({ title: "Test" }, fallback);

    expect(task.priority).toBe("high");
    expect(task.assignee).toBe("Default");
  });

  it("should override fallback with input", () => {
    const fallback = { priority: "high" as const };
    const task = normalizeTask({ title: "Test", priority: "low" }, fallback);

    expect(task.priority).toBe("low");
  });

  it("should deduplicate tags", () => {
    const task = normalizeTask({
      title: "Test",
      tags: ["a", "b", "a", "c", "b"]
    });

    expect(task.tags).toEqual(["a", "b", "c"]);
  });

  it("should filter out falsy tags", () => {
    const task = normalizeTask({
      title: "Test",
      tags: ["a", "", "b", null as unknown as string, "c"]
    });

    expect(task.tags).toEqual(["a", "b", "c"]);
  });

  it("should ensure non-negative hours", () => {
    const task = normalizeTask({
      title: "Test",
      estimateHours: -5,
      actualHours: -10
    });

    expect(task.estimateHours).toBe(0);
    expect(task.actualHours).toBe(0);
  });

  it("should use 'Untitled Task' for empty title", () => {
    const task1 = normalizeTask({ title: "" });
    const task2 = normalizeTask({ title: "   " });
    const task3 = normalizeTask({});

    expect(task1.title).toBe("Untitled Task");
    expect(task2.title).toBe("Untitled Task");
    expect(task3.title).toBe("Untitled Task");
  });

  it("should return 'Unassigned' for empty assignee", () => {
    const task = normalizeTask({ title: "Test", assignee: " " });
    expect(task.assignee).toBe("Unassigned");
  });

  it("should return empty string for empty blockedReason", () => {
    const task = normalizeTask({ title: "Test", blockedReason: " " });
    expect(task.blockedReason).toBe("");
  });
});

describe("comparePriority", () => {
  it("should compare priorities for descending sort (urgent first)", () => {
    // comparePriority returns b - a for descending sort
    // urgent (4) vs high (3): 3 - 4 = -1 < 0, so urgent comes before high
    expect(comparePriority("urgent", "high")).toBeLessThan(0);
    expect(comparePriority("high", "medium")).toBeLessThan(0);
    expect(comparePriority("medium", "low")).toBeLessThan(0);
    expect(comparePriority("urgent", "low")).toBeLessThan(0);
  });

  it("should return 0 for same priority", () => {
    expect(comparePriority("high", "high")).toBe(0);
    expect(comparePriority("low", "low")).toBe(0);
  });

  it("should return positive when first is lower priority", () => {
    // low (1) vs high (3): 3 - 1 = 2 > 0, so low comes after high
    expect(comparePriority("low", "high")).toBeGreaterThan(0);
    // medium (2) vs urgent (4): 4 - 2 = 2 > 0, so medium comes after urgent
    expect(comparePriority("medium", "urgent")).toBeGreaterThan(0);
  });
});

describe("sortTasks", () => {
  const tasks: TaskItem[] = [
    { id: "1", title: "A", priority: "low", status: "todo", dueDate: "2026-03-25" },
    { id: "2", title: "B", priority: "high", status: "done", dueDate: "2026-03-20" },
    { id: "3", title: "C", priority: "medium", status: "in_progress", dueDate: "2026-03-22" }
  ] as TaskItem[];

  it("should sort by priority (default)", () => {
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });

  it("should sort by dueDate (latest first)", () => {
    const sorted = sortTasks(tasks, "dueDate");
    // dueDate: 1=2026-03-25, 2=2026-03-20, 3=2026-03-22
    // diffInDays returns to - from, so later dates come first
    expect(sorted.map((t) => t.id)).toEqual(["1", "3", "2"]);
  });

  it("should sort by status", () => {
    const sorted = sortTasks(tasks, "status");
    expect(sorted[0].status).toBe("todo");
    expect(sorted[1].status).toBe("in_progress");
    expect(sorted[2].status).toBe("done");
  });

  it("should sort by title", () => {
    const sorted = sortTasks(tasks, "title");
    expect(sorted.map((t) => t.title)).toEqual(["A", "B", "C"]);
  });

  it("should not mutate original array", () => {
    const original = [...tasks];
    sortTasks(tasks);
    expect(tasks).toEqual(original);
  });
});

describe("filterTasks", () => {
  const tasks: TaskItem[] = [
    { id: "1", title: "Fix bug", status: "todo", priority: "high", assignee: "Alice", archived: false, dueDate: "2026-03-20", tags: ["bug"] },
    { id: "2", title: "Add feature", status: "done", priority: "medium", assignee: "Bob", archived: false, dueDate: "2026-03-25", tags: ["feature"] },
    { id: "3", title: "Review code", status: "todo", priority: "low", assignee: "Alice", archived: true, dueDate: "2026-03-15", tags: ["review"] }
  ] as TaskItem[];

  it("should filter by status", () => {
    const filter: TaskFilter = { status: "todo" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter by priority", () => {
    const filter: TaskFilter = { priority: "high" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter by assignee (excluding archived)", () => {
    const filter: TaskFilter = { assignee: "Alice" };
    const result = filterTasks(tasks, filter);
    // Only task 1 matches (task 3 is archived and excluded by default)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should exclude archived by default", () => {
    const filter: TaskFilter = {};
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(2);
  });

  it("should include archived when specified", () => {
    const filter: TaskFilter = { includeArchived: true };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(3);
  });

  it("should filter by keyword in title", () => {
    const filter: TaskFilter = { keyword: "fix" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Fix bug");
  });

  it("should filter by keyword in description", () => {
    const tasksWithDesc = tasks.map((t) => ({
      ...t,
      description: t.id === "1" ? "critical security issue" : "normal task"
    }));
    const filter: TaskFilter = { keyword: "security" };
    const result = filterTasks(tasksWithDesc as TaskItem[], filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should filter by keyword in tags", () => {
    const filter: TaskFilter = { keyword: "feature" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter overdue tasks", () => {
    const filter: TaskFilter = { overdueOnly: true };
    const result = filterTasks(tasks, filter);
    expect(result.every((t) => t.status !== "done" && new Date(t.dueDate) < new Date("2026-03-23"))).toBe(true);
  });

  it("should handle 'all' status filter", () => {
    const filter: TaskFilter = { status: "all" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(2);
  });

  it("should handle 'all' priority filter", () => {
    const filter: TaskFilter = { priority: "all" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(2);
  });

  it("should filter by keyword case-insensitively", () => {
    const filter: TaskFilter = { keyword: "BUG" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Fix bug");
  });

  it("should filter by multiple conditions (status + priority)", () => {
    const filter: TaskFilter = { status: "todo", priority: "high" };
    const result = filterTasks(tasks, filter);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].status).toBe("todo");
    expect(result[0].priority).toBe("high");
  });
});

describe("groupByStatus", () => {
  const tasks: TaskItem[] = [
    { id: "1", status: "todo" },
    { id: "2", status: "in_progress" },
    { id: "3", status: "todo" },
    { id: "4", status: "done" },
    { id: "5", status: "blocked" },
    { id: "6", status: "review" }
  ] as TaskItem[];

  it("should group tasks by status", () => {
    const grouped = groupByStatus(tasks);

    expect(grouped.todo).toHaveLength(2);
    expect(grouped.in_progress).toHaveLength(1);
    expect(grouped.done).toHaveLength(1);
    expect(grouped.blocked).toHaveLength(1);
    expect(grouped.review).toHaveLength(1);
  });

  it("should return empty arrays for missing statuses", () => {
    const grouped = groupByStatus([]);

    expect(grouped.todo).toEqual([]);
    expect(grouped.in_progress).toEqual([]);
    expect(grouped.done).toEqual([]);
    expect(grouped.blocked).toEqual([]);
    expect(grouped.review).toEqual([]);
  });
});

describe("calculateTaskStats", () => {
  const today = new Date("2026-03-23");

  const tasks: TaskItem[] = [
    { id: "1", status: "done", archived: false, dueDate: "2026-03-20" },
    { id: "2", status: "review", archived: false, dueDate: "2026-03-25" },
    { id: "3", status: "blocked", archived: false, dueDate: "2026-03-20" },
    { id: "4", status: "todo", archived: false, dueDate: "2026-03-15" },
    { id: "5", status: "done", archived: true, dueDate: "2026-03-10" }
  ] as TaskItem[];

  it("should calculate correct stats", () => {
    const stats = calculateTaskStats(tasks, today);

    expect(stats.total).toBe(4);
    expect(stats.done).toBe(1);
    expect(stats.review).toBe(1);
    expect(stats.blocked).toBe(1);
    // Task 4 (todo, due 2026-03-15) and Task 3 (blocked, due 2026-03-20) are both overdue
    expect(stats.overdue).toBe(2);
    expect(stats.archived).toBe(1);
    expect(stats.progress).toBe(25); // 1 done out of 4 active = 25%
  });

  it("should return 0 progress when no active tasks", () => {
    const stats = calculateTaskStats([], today);
    expect(stats.progress).toBe(0);
  });

  it("should return 100 progress when all done", () => {
    const allDone = tasks.map((t) => ({ ...t, status: "done" as TaskStatus }));
    const stats = calculateTaskStats(allDone, today);
    expect(stats.progress).toBe(100);
  });
});

describe("pickNextActionableTask", () => {
  const today = new Date("2026-03-23");

  it("should pick task with highest risk", () => {
    const tasks: TaskItem[] = [
      { id: "1", status: "todo", priority: "low", dueDate: "2026-03-20", archived: false, blockedReason: "" },
      { id: "2", status: "todo", priority: "urgent", dueDate: "2026-03-20", archived: false, blockedReason: "" }
    ] as TaskItem[];

    const next = pickNextActionableTask(tasks);
    expect(next?.id).toBe("2");
  });

  it("should exclude done and archived tasks", () => {
    const tasks: TaskItem[] = [
      { id: "1", status: "done", priority: "urgent", dueDate: "2026-03-20", archived: false, blockedReason: "" },
      { id: "2", status: "todo", priority: "low", dueDate: "2026-03-20", archived: false, blockedReason: "" },
      { id: "3", status: "todo", priority: "urgent", dueDate: "2026-03-20", archived: true, blockedReason: "" }
    ] as TaskItem[];

    const next = pickNextActionableTask(tasks);
    expect(next?.id).toBe("2");
  });

  it("should return undefined when no actionable tasks", () => {
    const tasks: TaskItem[] = [
      { id: "1", status: "done", archived: false, dueDate: "2026-03-20", blockedReason: "" }
    ] as TaskItem[];

    const next = pickNextActionableTask(tasks);
    expect(next).toBeUndefined();
  });
});

describe("collectTags", () => {
  it("should collect and deduplicate tags", () => {
    const tasks: TaskItem[] = [
      { id: "1", tags: ["bug", "urgent"] },
      { id: "2", tags: ["feature", "bug"] },
      { id: "3", tags: ["docs"] }
    ] as TaskItem[];

    const tags = collectTags(tasks);
    expect(tags).toEqual(["bug", "docs", "feature", "urgent"]);
  });

  it("should return empty array for no tasks", () => {
    expect(collectTags([])).toEqual([]);
  });

  it("should handle tasks with no tags", () => {
    const tasks: TaskItem[] = [
      { id: "1", tags: [] },
      { id: "2", tags: ["bug"] }
    ] as TaskItem[];

    expect(collectTags(tasks)).toEqual(["bug"]);
  });
});

describe("estimateWorkloadByAssignee", () => {
  it("should calculate remaining hours by assignee", () => {
    const tasks: TaskItem[] = [
      { id: "1", assignee: "Alice", status: "todo", estimateHours: 10, actualHours: 3, archived: false },
      { id: "2", assignee: "Alice", status: "in_progress", estimateHours: 8, actualHours: 5, archived: false },
      { id: "3", assignee: "Bob", status: "todo", estimateHours: 5, actualHours: 0, archived: false },
      { id: "4", assignee: "Alice", status: "done", estimateHours: 10, actualHours: 10, archived: false },
      { id: "5", assignee: "Alice", status: "todo", estimateHours: 6, actualHours: 8, archived: false }
    ] as TaskItem[];

    const workload = estimateWorkloadByAssignee(tasks);
    // Alice: (10-3)=7 + (8-5)=3 + max(6-8,0)=0 = 10
    expect(workload.Alice).toBe(10);
    expect(workload.Bob).toBe(5);
  });

  it("should exclude archived tasks", () => {
    const tasks: TaskItem[] = [
      { id: "1", assignee: "Alice", status: "todo", estimateHours: 10, actualHours: 0, archived: true }
    ] as TaskItem[];

    const workload = estimateWorkloadByAssignee(tasks);
    expect(workload.Alice).toBeUndefined();
  });

  it("should exclude done tasks", () => {
    const tasks: TaskItem[] = [
      { id: "1", assignee: "Alice", status: "done", estimateHours: 10, actualHours: 5, archived: false }
    ] as TaskItem[];

    const workload = estimateWorkloadByAssignee(tasks);
    expect(workload.Alice).toBeUndefined();
  });
});

describe("validateDependencies", () => {
  it("should detect missing dependencies", () => {
    const tasks: TaskItem[] = [
      { id: "1", dependencies: ["2", "3"] },
      { id: "2", dependencies: [] }
    ] as TaskItem[];

    const result = validateDependencies(tasks);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0]).toEqual({ taskId: "1", dependencyId: "3" });
  });

  it("should detect circular dependencies", () => {
    const tasks: TaskItem[] = [
      { id: "1", dependencies: ["2"] },
      { id: "2", dependencies: ["3"] },
      { id: "3", dependencies: ["1"] }
    ] as TaskItem[];

    const result = validateDependencies(tasks);
    expect(result.circular).toHaveLength(1);
    expect(result.circular[0]).toContain("1");
    expect(result.circular[0]).toContain("2");
    expect(result.circular[0]).toContain("3");
  });

  it("should return empty for valid dependencies", () => {
    const tasks: TaskItem[] = [
      { id: "1", dependencies: ["2"] },
      { id: "2", dependencies: [] }
    ] as TaskItem[];

    const result = validateDependencies(tasks);
    expect(result.missing).toEqual([]);
    expect(result.circular).toEqual([]);
  });

  it("should handle self-dependency as circular", () => {
    const tasks: TaskItem[] = [
      { id: "1", dependencies: ["1"] }
    ] as TaskItem[];

    const result = validateDependencies(tasks);
    expect(result.circular).toHaveLength(1);
    // Self-dependency creates path ["1", "1"], slice from index 0 gives ["1", "1"]
    expect(result.circular[0]).toEqual(["1", "1"]);
  });

  it("should detect self-reference as circular dependency", () => {
    // Task depends on itself - a clear circular dependency
    const tasks: TaskItem[] = [
      { id: "task_self", title: "Self-depending Task", dependencies: ["task_self"] }
    ] as TaskItem[];

    const result = validateDependencies(tasks);

    expect(result.missing).toHaveLength(0);
    expect(result.circular).toHaveLength(1);
    expect(result.circular[0]).toContain("task_self");
  });
});

describe("mergeTaskPatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23"));
  });

  it("should merge patch into task", () => {
    const task: TaskItem = {
      id: "1",
      title: "Old Title",
      priority: "low",
      status: "todo"
    } as TaskItem;

    const patched = mergeTaskPatch(task, { title: "New Title", priority: "high" });

    expect(patched.title).toBe("New Title");
    expect(patched.priority).toBe("high");
    expect(patched.status).toBe("todo");
  });

  it("should update updatedAt timestamp", () => {
    const task: TaskItem = {
      id: "1",
      title: "Task",
      updatedAt: "2026-03-20"
    } as TaskItem;

    const patched = mergeTaskPatch(task, { title: "Updated" });

    expect(patched.updatedAt).toBe("2026-03-23");
  });

  it("should preserve id", () => {
    const task: TaskItem = {
      id: "task_abc123",
      title: "Task"
    } as TaskItem;

    const patched = mergeTaskPatch(task, { title: "Updated" });

    expect(patched.id).toBe("task_abc123");
  });
});
