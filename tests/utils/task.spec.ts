import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskFilter, TaskItem, TaskPriority, TaskStatus } from "@/types/task";
import {
  calculateTaskStats,
  collectTags,
  comparePriority,
  estimateWorkloadByAssignee,
  filterTasks,
  groupByStatus,
  mergeTaskPatch,
  normalizeTask,
  pickNextActionableTask,
  sortTasks,
  validateDependencies
} from "@/utils/task";

function createTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return normalizeTask({
    id: "task-1",
    title: "Test Task",
    ...overrides
  });
}

describe("normalizeTask", () => {
  it("should create task with all defaults", () => {
    const task = normalizeTask({});

    expect(task.id).toMatch(/^task_[a-z0-9]+$/);
    expect(task.title).toBe("Untitled Task");
    expect(task.description).toBe("");
    expect(task.priority).toBe("medium");
    expect(task.status).toBe("todo");
    expect(task.assignee).toBe("Unassigned");
    expect(task.tags).toEqual([]);
    expect(task.estimateHours).toBe(0);
    expect(task.actualHours).toBe(0);
    expect(task.blockedReason).toBe("");
    expect(task.dependencies).toEqual([]);
    expect(task.archived).toBe(false);
  });

  it("should preserve provided values", () => {
    const task = normalizeTask({
      id: "custom-id",
      title: "Custom Title",
      description: "Custom description",
      priority: "urgent",
      status: "in_progress",
      assignee: "John Doe",
      tags: ["frontend", "bug"],
      estimateHours: 8,
      actualHours: 4,
      blockedReason: "Waiting for API",
      dependencies: ["task-0"],
      sprint: "Sprint 1",
      archived: true
    });

    expect(task.id).toBe("custom-id");
    expect(task.title).toBe("Custom Title");
    expect(task.description).toBe("Custom description");
    expect(task.priority).toBe("urgent");
    expect(task.status).toBe("in_progress");
    expect(task.assignee).toBe("John Doe");
    expect(task.tags).toEqual(["frontend", "bug"]);
    expect(task.estimateHours).toBe(8);
    expect(task.actualHours).toBe(4);
    expect(task.blockedReason).toBe("Waiting for API");
    expect(task.dependencies).toEqual(["task-0"]);
    expect(task.sprint).toBe("Sprint 1");
    expect(task.archived).toBe(true);
  });

  it("should trim whitespace from string fields", () => {
    const task = normalizeTask({
      title: "  Padded Title  ",
      description: "  Padded description  ",
      assignee: "  John Doe  ",
      blockedReason: "  Reason  ",
      reviewer: "  Reviewer  ",
      sprint: "  Sprint 1  "
    });

    expect(task.title).toBe("Padded Title");
    expect(task.description).toBe("Padded description");
    expect(task.assignee).toBe("John Doe");
    expect(task.blockedReason).toBe("Reason");
    expect(task.reviewer).toBe("Reviewer");
    expect(task.sprint).toBe("Sprint 1");
  });

  it("should use fallback values", () => {
    const task = normalizeTask({}, { title: "Fallback Title", priority: "high" });

    expect(task.title).toBe("Fallback Title");
    expect(task.priority).toBe("high");
  });

  it("should deduplicate and filter tags", () => {
    const task = normalizeTask({
      tags: ["frontend", "bug", "frontend", "", "bug", "urgent"]
    });

    expect(task.tags).toEqual(["frontend", "bug", "urgent"]);
  });

  it("should deduplicate and filter dependencies", () => {
    const task = normalizeTask({
      dependencies: ["task-1", "task-2", "task-1", "", "task-3"]
    });

    expect(task.dependencies).toEqual(["task-1", "task-2", "task-3"]);
  });

  it("should handle empty title by using default", () => {
    const task = normalizeTask({ title: "   " });

    expect(task.title).toBe("Untitled Task");
  });

  it("should handle empty assignee by using default", () => {
    const task = normalizeTask({ assignee: "   " });

    expect(task.assignee).toBe("Unassigned");
  });

  it("should clamp negative hours to 0", () => {
    const task = normalizeTask({ estimateHours: -5, actualHours: -3 });

    expect(task.estimateHours).toBe(0);
    expect(task.actualHours).toBe(0);
  });

  it("should use empty string for empty blockedReason", () => {
    const task = normalizeTask({ blockedReason: "   " });

    expect(task.blockedReason).toBe("");
  });
});

describe("comparePriority", () => {
  it("should return positive when a has lower priority than b", () => {
    expect(comparePriority("low", "high")).toBeGreaterThan(0);
  });

  it("should return negative when a has higher priority than b", () => {
    expect(comparePriority("urgent", "low")).toBeLessThan(0);
  });

  it("should return 0 for same priority", () => {
    expect(comparePriority("medium", "medium")).toBe(0);
  });

  it("should follow priority order: urgent > high > medium > low", () => {
    const priorities: TaskPriority[] = ["urgent", "high", "medium", "low"];
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(comparePriority(priorities[i + 1], priorities[i])).toBeGreaterThan(0);
    }
  });
});

describe("sortTasks", () => {
  const tasks: TaskItem[] = [
    createTask({ id: "t1", title: "Alpha", priority: "low", status: "done", dueDate: "2024-03-20", updatedAt: "2024-03-10" }),
    createTask({ id: "t2", title: "Beta", priority: "urgent", status: "todo", dueDate: "2024-03-15", updatedAt: "2024-03-12" }),
    createTask({ id: "t3", title: "Charlie", priority: "high", status: "in_progress", dueDate: "2024-03-18", updatedAt: "2024-03-11" })
  ];

  it("should sort by priority by default", () => {
    const sorted = sortTasks(tasks);

    expect(sorted[0].id).toBe("t2");
    expect(sorted[1].id).toBe("t3");
    expect(sorted[2].id).toBe("t1");
  });

  it("should sort by dueDate (descending - latest first)", () => {
    const sorted = sortTasks(tasks, "dueDate");

    expect(sorted[0].id).toBe("t1");
    expect(sorted[1].id).toBe("t3");
    expect(sorted[2].id).toBe("t2");
  });

  it("should sort by status", () => {
    const sorted = sortTasks(tasks, "status");

    expect(sorted[0].status).toBe("todo");
    expect(sorted[1].status).toBe("in_progress");
    expect(sorted[2].status).toBe("done");
  });

  it("should sort by title alphabetically", () => {
    const sorted = sortTasks(tasks, "title");

    expect(sorted[0].title).toBe("Alpha");
    expect(sorted[1].title).toBe("Beta");
    expect(sorted[2].title).toBe("Charlie");
  });

  it("should not mutate original array", () => {
    const original = [...tasks];
    sortTasks(tasks, "priority");

    expect(tasks).toEqual(original);
  });
});

describe("filterTasks", () => {
  const tasks: TaskItem[] = [
    createTask({ id: "t1", title: "Frontend Bug", status: "todo", priority: "high", assignee: "Alice", archived: false, tags: ["frontend"] }),
    createTask({ id: "t2", title: "Backend API", status: "done", priority: "medium", assignee: "Bob", archived: false, tags: ["backend"] }),
    createTask({ id: "t3", title: "Database Task", status: "blocked", priority: "urgent", assignee: "Alice", archived: true, tags: ["database"] }),
    createTask({ id: "t4", title: "UI Design", status: "in_progress", priority: "low", assignee: "Charlie", archived: false, tags: ["design"] })
  ];

  it("should return all tasks with empty filter", () => {
    const result = filterTasks(tasks, {});
    expect(result.length).toBe(3);
    expect(result.every(t => !t.archived)).toBe(true);
  });

  it("should filter by status", () => {
    const result = filterTasks(tasks, { status: "todo" });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("t1");
  });

  it("should filter by status 'all'", () => {
    const result = filterTasks(tasks, { status: "all" });
    expect(result.length).toBe(3);
  });

  it("should filter by priority", () => {
    const result = filterTasks(tasks, { priority: "urgent" });
    expect(result.length).toBe(0);
  });

  it("should filter by assignee", () => {
    const result = filterTasks(tasks, { assignee: "Alice" });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("t1");
  });

  it("should filter by keyword in title", () => {
    const result = filterTasks(tasks, { keyword: "Frontend" });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("t1");
  });

  it("should filter by keyword in tags", () => {
    const result = filterTasks(tasks, { keyword: "backend" });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("t2");
  });

  it("should include archived when flag is set", () => {
    const result = filterTasks(tasks, { includeArchived: true });
    expect(result.length).toBe(4);
  });

  it("should combine multiple filters", () => {
    const result = filterTasks(tasks, {
      status: "todo",
      priority: "high"
    });
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("t1");
  });

  it("should be case-insensitive for keyword search", () => {
    const result = filterTasks(tasks, { keyword: "FRONTEND" });
    expect(result.length).toBe(1);
  });
});

describe("groupByStatus", () => {
  it("should group tasks by status", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", status: "todo" }),
      createTask({ id: "t2", status: "todo" }),
      createTask({ id: "t3", status: "in_progress" }),
      createTask({ id: "t4", status: "done" })
    ];

    const result = groupByStatus(tasks);

    expect(result.todo.length).toBe(2);
    expect(result.in_progress.length).toBe(1);
    expect(result.review.length).toBe(0);
    expect(result.blocked.length).toBe(0);
    expect(result.done.length).toBe(1);
  });

  it("should return empty arrays for all statuses when no tasks", () => {
    const result = groupByStatus([]);

    expect(result.todo).toEqual([]);
    expect(result.in_progress).toEqual([]);
    expect(result.review).toEqual([]);
    expect(result.blocked).toEqual([]);
    expect(result.done).toEqual([]);
  });
});

describe("calculateTaskStats", () => {
  it("should calculate stats correctly", () => {
    const today = new Date("2024-03-15");
    const tasks: TaskItem[] = [
      createTask({ id: "t1", status: "done", archived: false }),
      createTask({ id: "t2", status: "review", archived: false }),
      createTask({ id: "t3", status: "blocked", archived: false }),
      createTask({ id: "t4", status: "todo", archived: true }),
      createTask({ id: "t5", status: "todo", dueDate: "2024-03-10", archived: false })
    ];

    const stats = calculateTaskStats(tasks, today);

    expect(stats.total).toBe(4);
    expect(stats.done).toBe(1);
    expect(stats.review).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.archived).toBe(1);
    expect(stats.overdue).toBe(1);
    expect(stats.progress).toBe(25);
  });

  it("should return zero stats for empty array", () => {
    const stats = calculateTaskStats([]);

    expect(stats.total).toBe(0);
    expect(stats.done).toBe(0);
    expect(stats.progress).toBe(0);
  });

  it("should calculate progress as percentage", () => {
    const tasks: TaskItem[] = [
      createTask({ status: "done" }),
      createTask({ status: "done" }),
      createTask({ status: "todo" }),
      createTask({ status: "todo" })
    ];

    const stats = calculateTaskStats(tasks);

    expect(stats.progress).toBe(50);
  });
});

describe("pickNextActionableTask", () => {
  it("should return undefined for empty array", () => {
    expect(pickNextActionableTask([])).toBeUndefined();
  });

  it("should exclude archived tasks", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", archived: true, priority: "urgent" })
    ];

    expect(pickNextActionableTask(tasks)).toBeUndefined();
  });

  it("should exclude done tasks", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", status: "done" })
    ];

    expect(pickNextActionableTask(tasks)).toBeUndefined();
  });

  it("should prioritize by risk and due date", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", priority: "low", status: "todo", dueDate: "2099-12-31" }),
      createTask({ id: "t2", priority: "urgent", status: "todo", dueDate: "2099-12-30" })
    ];

    const result = pickNextActionableTask(tasks);

    expect(result).toBeDefined();
    expect(["t1", "t2"]).toContain(result!.id);
  });
});

describe("collectTags", () => {
  it("should collect unique tags from all tasks", () => {
    const tasks: TaskItem[] = [
      createTask({ tags: ["frontend", "bug"] }),
      createTask({ tags: ["backend", "bug"] }),
      createTask({ tags: ["frontend", "feature"] })
    ];

    const tags = collectTags(tasks);

    expect(tags).toEqual(["backend", "bug", "feature", "frontend"]);
  });

  it("should return empty array for tasks without tags", () => {
    const tasks: TaskItem[] = [
      createTask({ tags: [] }),
      createTask({ tags: [] })
    ];

    expect(collectTags(tasks)).toEqual([]);
  });
});

describe("estimateWorkloadByAssignee", () => {
  it("should calculate remaining hours per assignee", () => {
    const tasks: TaskItem[] = [
      createTask({ assignee: "Alice", estimateHours: 10, actualHours: 4, status: "todo" }),
      createTask({ assignee: "Alice", estimateHours: 8, actualHours: 2, status: "in_progress" }),
      createTask({ assignee: "Bob", estimateHours: 5, actualHours: 0, status: "todo" }),
      createTask({ assignee: "Bob", estimateHours: 3, actualHours: 3, status: "done" })
    ];

    const workload = estimateWorkloadByAssignee(tasks);

    expect(workload["Alice"]).toBe(12);
    expect(workload["Bob"]).toBe(5);
  });

  it("should exclude archived tasks", () => {
    const tasks: TaskItem[] = [
      createTask({ assignee: "Alice", estimateHours: 10, actualHours: 0, archived: true })
    ];

    expect(estimateWorkloadByAssignee(tasks)).toEqual({});
  });

  it("should exclude done tasks", () => {
    const tasks: TaskItem[] = [
      createTask({ assignee: "Alice", estimateHours: 10, actualHours: 0, status: "done" })
    ];

    expect(estimateWorkloadByAssignee(tasks)).toEqual({});
  });

  it("should not return negative remaining hours", () => {
    const tasks: TaskItem[] = [
      createTask({ assignee: "Alice", estimateHours: 5, actualHours: 10, status: "in_progress" })
    ];

    expect(estimateWorkloadByAssignee(tasks)).toEqual({ Alice: 0 });
  });
});

describe("validateDependencies", () => {
  it("should detect missing dependencies", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", dependencies: ["missing-task"] })
    ];

    const result = validateDependencies(tasks);

    expect(result.missing).toEqual([{ taskId: "t1", dependencyId: "missing-task" }]);
    expect(result.circular).toEqual([]);
  });

  it("should detect circular dependencies", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", dependencies: ["t2"] }),
      createTask({ id: "t2", dependencies: ["t3"] }),
      createTask({ id: "t3", dependencies: ["t1"] })
    ];

    const result = validateDependencies(tasks);

    expect(result.circular.length).toBeGreaterThan(0);
  });

  it("should return empty arrays for valid dependencies", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", dependencies: [] }),
      createTask({ id: "t2", dependencies: ["t1"] })
    ];

    const result = validateDependencies(tasks);

    expect(result.missing).toEqual([]);
    expect(result.circular).toEqual([]);
  });

  it("should handle self-referencing dependency", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "t1", dependencies: ["t1"] })
    ];

    const result = validateDependencies(tasks);

    expect(result.circular.length).toBeGreaterThan(0);
  });
});

describe("mergeTaskPatch", () => {
  it("should merge patch into task", () => {
    const task = createTask({ id: "t1", title: "Original", priority: "low" });
    const patched = mergeTaskPatch(task, { title: "Updated", priority: "high" });

    expect(patched.title).toBe("Updated");
    expect(patched.priority).toBe("high");
    expect(patched.id).toBe("t1");
  });

  it("should update updatedAt timestamp", () => {
    const task = createTask({ id: "t1", updatedAt: "2024-01-01" });
    const patched = mergeTaskPatch(task, { title: "Updated" });

    expect(patched.updatedAt).not.toBe("2024-01-01");
  });

  it("should normalize merged result", () => {
    const task = createTask({ id: "t1" });
    const patched = mergeTaskPatch(task, { title: "  Padded  " });

    expect(patched.title).toBe("Padded");
  });
});
