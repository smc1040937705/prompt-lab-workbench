import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTaskStore } from "@/store/modules/tasks";
import type { TaskItem, TaskStatus } from "@/types/task";
import type { WorkflowContext } from "@/types/workflow";

describe("useTaskStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:00:00"));
  });

  describe("state initialization", () => {
    it("should initialize with mock tasks", () => {
      const store = useTaskStore();
      expect(store.tasks.length).toBeGreaterThan(0);
    });

    it("should have default filter", () => {
      const store = useTaskStore();
      expect(store.filter.status).toBe("all");
      expect(store.filter.priority).toBe("all");
    });

    it("should have default sort", () => {
      const store = useTaskStore();
      expect(store.sortBy).toBe("priority");
    });

    it("should have empty selection", () => {
      const store = useTaskStore();
      expect(store.selectedTaskIds).toEqual([]);
    });
  });

  describe("getters - visibleTasks", () => {
    it("should filter and sort tasks", () => {
      const store = useTaskStore();
      const visible = store.visibleTasks;

      expect(visible.length).toBeGreaterThan(0);
      expect(visible.every((t) => !t.archived)).toBe(true);
    });

    it("should respect status filter", () => {
      const store = useTaskStore();
      store.setFilter({ status: "todo" });

      const visible = store.visibleTasks;
      expect(visible.every((t) => t.status === "todo")).toBe(true);
    });

    it("should respect keyword filter", () => {
      const store = useTaskStore();
      store.setFilter({ keyword: "auth" });

      const visible = store.visibleTasks;
      expect(visible.every((t) =>
        t.title.toLowerCase().includes("auth") ||
        t.description.toLowerCase().includes("auth")
      )).toBe(true);
    });
  });

  describe("getters - stats", () => {
    it("should calculate task statistics", () => {
      const store = useTaskStore();
      const stats = store.stats;

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.done).toBeGreaterThanOrEqual(0);
      expect(stats.progress).toBeGreaterThanOrEqual(0);
      expect(stats.progress).toBeLessThanOrEqual(100);
    });
  });

  describe("getters - assigneeList", () => {
    it("should return unique assignees", () => {
      const store = useTaskStore();
      const assignees = store.assigneeList;

      expect(assignees.length).toBeGreaterThan(0);
      expect(new Set(assignees).size).toBe(assignees.length);
    });
  });

  describe("getters - tagList", () => {
    it("should return unique tags", () => {
      const store = useTaskStore();
      const tags = store.tagList;

      expect(new Set(tags).size).toBe(tags.length);
    });
  });

  describe("getters - workloadByAssignee", () => {
    it("should calculate workload", () => {
      const store = useTaskStore();
      const workload = store.workloadByAssignee;

      Object.values(workload).forEach((hours) => {
        expect(hours).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("getters - dependencyIssues", () => {
    it("should detect dependency issues", () => {
      const store = useTaskStore();
      const issues = store.dependencyIssues;

      expect(issues.missing).toBeDefined();
      expect(issues.circular).toBeDefined();
    });
  });

  describe("setFilter", () => {
    it("should update filter", () => {
      const store = useTaskStore();
      store.setFilter({ status: "done", priority: "high" });

      expect(store.filter.status).toBe("done");
      expect(store.filter.priority).toBe("high");
    });

    it("should merge with existing filter", () => {
      const store = useTaskStore();
      store.setFilter({ status: "done" });
      store.setFilter({ priority: "high" });

      expect(store.filter.status).toBe("done");
      expect(store.filter.priority).toBe("high");
    });
  });

  describe("resetFilter", () => {
    it("should reset filter to defaults", () => {
      const store = useTaskStore();
      store.setFilter({ status: "done", priority: "high", keyword: "test" });

      store.resetFilter();

      expect(store.filter.status).toBe("all");
      expect(store.filter.priority).toBe("all");
      expect(store.filter.keyword).toBe("");
    });
  });

  describe("setSortBy", () => {
    it("should change sort key", () => {
      const store = useTaskStore();
      store.setSortBy("dueDate");

      expect(store.sortBy).toBe("dueDate");
    });
  });

  describe("setWeeklyVelocity", () => {
    it("should set velocity", () => {
      const store = useTaskStore();
      store.setWeeklyVelocity(40);

      expect(store.weeklyVelocityHours).toBe(40);
    });

    it("should ensure non-negative", () => {
      const store = useTaskStore();
      store.setWeeklyVelocity(-10);

      expect(store.weeklyVelocityHours).toBe(0);
    });

    it("should round to integer", () => {
      const store = useTaskStore();
      store.setWeeklyVelocity(35.7);

      expect(store.weeklyVelocityHours).toBe(36);
    });
  });

  describe("addTask", () => {
    it("should add new task", () => {
      const store = useTaskStore();
      const initialCount = store.tasks.length;

      const task = store.addTask({ title: "New Task", priority: "high" });

      expect(store.tasks.length).toBe(initialCount + 1);
      expect(task.title).toBe("New Task");
      expect(task.id).toBeDefined();
    });

    it("should add to beginning of list", () => {
      const store = useTaskStore();
      const firstTask = store.tasks[0];

      store.addTask({ title: "First Task" });

      expect(store.tasks[0].title).toBe("First Task");
      expect(store.tasks[1]).toEqual(firstTask);
    });
  });

  describe("updateTask", () => {
    it("should update existing task", () => {
      const store = useTaskStore();
      const task = store.tasks[0];
      const originalId = task.id;

      const updated = store.updateTask(originalId, { title: "Updated Title" });

      expect(updated?.title).toBe("Updated Title");
      expect(updated?.id).toBe(originalId);
    });

    it("should return undefined for non-existent task", () => {
      const store = useTaskStore();
      const result = store.updateTask("non-existent", { title: "Test" });

      expect(result).toBeUndefined();
    });

    it("should update timestamp", () => {
      const store = useTaskStore();
      const task = store.tasks[0];

      const updated = store.updateTask(task.id, { title: "Updated" });

      expect(updated?.updatedAt).toBe("2026-03-23");
    });
  });

  describe("removeTask", () => {
    it("should remove task by id", () => {
      const store = useTaskStore();
      const task = store.tasks[0];
      const initialCount = store.tasks.length;

      const result = store.removeTask(task.id);

      expect(result).toBe(true);
      expect(store.tasks.length).toBe(initialCount - 1);
      expect(store.tasks.find((t) => t.id === task.id)).toBeUndefined();
    });

    it("should return false for non-existent task", () => {
      const store = useTaskStore();
      const result = store.removeTask("non-existent");

      expect(result).toBe(false);
    });

    it("should remove from selection", () => {
      const store = useTaskStore();
      const task = store.tasks[0];
      store.selectTasks([task.id]);

      store.removeTask(task.id);

      expect(store.selectedTaskIds).not.toContain(task.id);
    });
  });

  describe("archiveTask", () => {
    it("should archive task", () => {
      const store = useTaskStore();
      const task = store.tasks.find((t) => !t.archived);
      if (!task) return;

      const result = store.archiveTask(task.id);

      expect(result).toBe(true);
      expect(store.tasks.find((t) => t.id === task.id)?.archived).toBe(true);
    });

    it("should return false for non-existent task", () => {
      const store = useTaskStore();
      const result = store.archiveTask("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("setTaskStatus", () => {
    it("should update status", () => {
      const store = useTaskStore();
      const task = store.tasks.find((t) => t.status !== "done");
      if (!task) return;

      const result = store.setTaskStatus(task.id, "in_progress");

      expect(result).toBe(true);
      expect(store.tasks.find((t) => t.id === task.id)?.status).toBe("in_progress");
    });

    it("should auto-fill actualHours when marking done (if actualHours is 0)", () => {
      const store = useTaskStore();
      // Find a task with actualHours === 0 to test auto-fill
      const task = store.tasks.find((t) => t.status !== "done" && t.estimateHours > 0 && t.actualHours === 0);
      if (!task) {
        // If no such task exists, create one
        const newTask = store.addTask({ title: "Test Task", estimateHours: 10, actualHours: 0 });
        store.setTaskStatus(newTask.id, "done");
        const updated = store.tasks.find((t) => t.id === newTask.id);
        expect(updated?.actualHours).toBe(10);
      } else {
        const originalEstimate = task.estimateHours;
        store.setTaskStatus(task.id, "done");
        const updated = store.tasks.find((t) => t.id === task.id);
        expect(updated?.actualHours).toBe(originalEstimate);
      }
    });

    it("should return false for non-existent task", () => {
      const store = useTaskStore();
      const result = store.setTaskStatus("non-existent", "done");

      expect(result).toBe(false);
    });
  });

  describe("transitionTask", () => {
    it("should perform valid transition", () => {
      const store = useTaskStore();
      const task = store.tasks.find((t) => t.status === "todo");
      if (!task) return;

      const context: WorkflowContext = {
        actorId: "user_1",
        actorRole: "owner"
      };

      const result = store.transitionTask(task.id, "in_progress", context);

      expect(result.allowed).toBe(true);
      expect(store.tasks.find((t) => t.id === task.id)?.status).toBe("in_progress");
    });

    it("should reject invalid transition", () => {
      const store = useTaskStore();
      const task = store.tasks.find((t) => t.status === "todo");
      if (!task) return;

      const context: WorkflowContext = {
        actorId: "user_1",
        actorRole: "member"
      };

      const result = store.transitionTask(task.id, "blocked", context);

      expect(result.allowed).toBe(false);
    });

    it("should create workflow log", () => {
      const store = useTaskStore();
      const task = store.tasks.find((t) => t.status === "todo");
      if (!task) return;

      const context: WorkflowContext = {
        actorId: "user_1",
        actorRole: "owner"
      };

      store.transitionTask(task.id, "in_progress", context);

      expect(store.workflowLogs.length).toBeGreaterThan(0);
      expect(store.workflowLogs[0].taskId).toBe(task.id);
    });

    it("should limit workflow logs to 100", () => {
      const store = useTaskStore();
      store.workflowLogs = Array(100).fill(null).map((_, i) => ({
        taskId: `task_${i}`,
        from: "todo",
        to: "in_progress",
        actorId: "user",
        actorRole: "owner",
        note: "",
        at: "2026-03-23T10:00:00"
      }));

      const task = store.tasks[0];
      store.transitionTask(task.id, "in_progress", {
        actorId: "user",
        actorRole: "owner"
      });

      expect(store.workflowLogs.length).toBe(100);
    });
  });

  describe("selection", () => {
    it("should toggle selection", () => {
      const store = useTaskStore();
      const task = store.tasks[0];

      store.toggleSelectTask(task.id);
      expect(store.selectedTaskIds).toContain(task.id);

      store.toggleSelectTask(task.id);
      expect(store.selectedTaskIds).not.toContain(task.id);
    });

    it("should select multiple tasks", () => {
      const store = useTaskStore();
      const ids = store.tasks.slice(0, 3).map((t) => t.id);

      store.selectTasks(ids);

      expect(store.selectedTaskIds).toEqual(ids);
    });

    it("should clear selection", () => {
      const store = useTaskStore();
      store.selectTasks(["task_1", "task_2"]);

      store.clearSelection();

      expect(store.selectedTaskIds).toEqual([]);
    });

    it("should return selected tasks", () => {
      const store = useTaskStore();
      const tasks = store.tasks.slice(0, 2);
      store.selectTasks(tasks.map((t) => t.id));

      expect(store.selectedTasks).toHaveLength(2);
      expect(store.selectedTasks[0].id).toBe(tasks[0].id);
    });
  });

  describe("bulkArchive", () => {
    it("should archive selected tasks", () => {
      const store = useTaskStore();
      const tasks = store.tasks.filter((t) => !t.archived).slice(0, 3);
      store.selectTasks(tasks.map((t) => t.id));

      const count = store.bulkArchive();

      expect(count).toBe(3);
      tasks.forEach((task) => {
        expect(store.tasks.find((t) => t.id === task.id)?.archived).toBe(true);
      });
    });

    it("should clear selection of archived tasks", () => {
      const store = useTaskStore();
      const tasks = store.tasks.filter((t) => !t.archived).slice(0, 2);
      store.selectTasks(tasks.map((t) => t.id));

      store.bulkArchive();

      expect(store.selectedTaskIds).toHaveLength(0);
    });
  });

  describe("clearDone", () => {
    it("should remove done tasks (excluding archived by default)", () => {
      const store = useTaskStore();
      const initialCount = store.tasks.length;
      const doneCount = store.tasks.filter((t) => t.status === "done" && !t.archived).length;

      const removed = store.clearDone();

      expect(removed).toBe(doneCount);
      expect(store.tasks.length).toBe(initialCount - doneCount);
      // Only non-archived done tasks should be removed
      expect(store.tasks.every((t) => t.status !== "done" || t.archived)).toBe(true);
    });

    it("should remove all done tasks when including archived", () => {
      const store = useTaskStore();
      const initialCount = store.tasks.length;
      const doneCount = store.tasks.filter((t) => t.status === "done").length;

      const removed = store.clearDone(true);

      expect(removed).toBe(doneCount);
      expect(store.tasks.length).toBe(initialCount - doneCount);
      expect(store.tasks.every((t) => t.status !== "done")).toBe(true);
    });
  });

  describe("importTasks", () => {
    it("should add new tasks in merge mode", () => {
      const store = useTaskStore();
      const initialCount = store.tasks.length;

      const count = store.importTasks([
        { title: "Imported 1" },
        { title: "Imported 2" }
      ]);

      expect(count).toBe(2);
      expect(store.tasks.length).toBe(initialCount + 2);
    });

    it("should update existing tasks in merge mode", () => {
      const store = useTaskStore();
      const existingTask = store.tasks[0];

      store.importTasks([
        { id: existingTask.id, title: "Updated Title" }
      ]);

      expect(store.tasks.find((t) => t.id === existingTask.id)?.title).toBe("Updated Title");
    });

    it("should replace all tasks in replace mode", () => {
      const store = useTaskStore();

      store.importTasks([
        { title: "Only Task" }
      ], "replace");

      expect(store.tasks.length).toBe(1);
      expect(store.tasks[0].title).toBe("Only Task");
    });
  });

  describe("resetState", () => {
    it("should reset to initial state", () => {
      const store = useTaskStore();
      store.setFilter({ status: "done" });
      store.setSortBy("dueDate");
      store.selectTasks(["task_1"]);

      store.resetState();

      expect(store.filter.status).toBe("all");
      expect(store.sortBy).toBe("priority");
      expect(store.selectedTaskIds).toEqual([]);
    });
  });
});
