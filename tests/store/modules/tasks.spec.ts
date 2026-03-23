import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { TaskFilter, TaskItem, TaskStatus } from "@/types/task";
import type { WorkflowContext } from "@/types/workflow";
import { useTaskStore } from "@/store/modules/tasks";

function createTaskInput(overrides: Partial<TaskItem> = {}): Partial<TaskItem> {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Test Task",
    ...overrides
  };
}

function createContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    actorId: "user-1",
    actorRole: "owner",
    ...overrides
  };
}

describe("useTaskStore", () => {
  let store: ReturnType<typeof useTaskStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTaskStore();
    store.tasks = [];
  });

  describe("initial state", () => {
    it("should have empty filter", () => {
      expect(store.filter.status).toBe("all");
      expect(store.filter.priority).toBe("all");
      expect(store.filter.includeArchived).toBe(false);
    });

    it("should have default sortBy", () => {
      expect(store.sortBy).toBe("priority");
    });

    it("should have empty selectedTaskIds", () => {
      expect(store.selectedTaskIds).toEqual([]);
    });

    it("should have default weeklyVelocityHours", () => {
      expect(store.weeklyVelocityHours).toBe(34);
    });
  });

  describe("getters", () => {
    beforeEach(() => {
      store.tasks = [
        createTaskInput({ id: "t1", title: "Task 1", status: "todo", priority: "high", assignee: "Alice", archived: false }),
        createTaskInput({ id: "t2", title: "Task 2", status: "done", priority: "low", assignee: "Bob", archived: false }),
        createTaskInput({ id: "t3", title: "Task 3", status: "todo", priority: "medium", assignee: "Alice", archived: true })
      ].map(t => ({
        ...t,
        description: "",
        dueDate: "2024-03-20",
        createdAt: "2024-03-01",
        updatedAt: "2024-03-01",
        tags: [],
        estimateHours: 0,
        actualHours: 0,
        blockedReason: "",
        dependencies: [],
        archived: t.archived ?? false
      })) as TaskItem[];
    });

    describe("visibleTasks", () => {
      it("should filter and sort tasks", () => {
        store.filter = { status: "all", priority: "all", includeArchived: false };
        store.sortBy = "priority";

        const visible = store.visibleTasks;

        expect(visible.length).toBe(2);
        expect(visible.every(t => !t.archived)).toBe(true);
      });
    });

    describe("groupedVisibleTasks", () => {
      it("should group visible tasks by status", () => {
        const grouped = store.groupedVisibleTasks;

        expect(grouped.todo.length).toBe(1);
        expect(grouped.done.length).toBe(1);
      });
    });

    describe("stats", () => {
      it("should calculate task statistics", () => {
        const stats = store.stats;

        expect(stats.total).toBe(2);
        expect(stats.done).toBe(1);
      });
    });

    describe("assigneeList", () => {
      it("should return sorted unique assignees", () => {
        const assignees = store.assigneeList;

        expect(assignees).toContain("Alice");
        expect(assignees).toContain("Bob");
      });
    });

    describe("tagList", () => {
      it("should return sorted unique tags", () => {
        store.tasks[0].tags = ["frontend", "bug"];
        store.tasks[1].tags = ["backend", "bug"];

        const tags = store.tagList;

        expect(tags).toContain("frontend");
        expect(tags).toContain("backend");
        expect(tags).toContain("bug");
      });
    });

    describe("selectedTasks", () => {
      it("should return selected tasks", () => {
        store.selectedTaskIds = ["t1", "t3"];

        const selected = store.selectedTasks;

        expect(selected.length).toBe(2);
        expect(selected.map(t => t.id)).toContain("t1");
      });
    });

    describe("workloadByAssignee", () => {
      it("should calculate workload per assignee", () => {
        store.tasks[0].estimateHours = 10;
        store.tasks[0].actualHours = 2;
        store.tasks[0].status = "in_progress";

        const workload = store.workloadByAssignee;

        expect(workload["Alice"]).toBe(8);
      });
    });
  });

  describe("actions", () => {
    describe("setFilter", () => {
      it("should merge filter with existing", () => {
        store.setFilter({ status: "todo" });

        expect(store.filter.status).toBe("todo");
        expect(store.filter.priority).toBe("all");
      });
    });

    describe("resetFilter", () => {
      it("should reset filter to initial state", () => {
        store.filter = { status: "done", priority: "high", keyword: "test" };
        store.resetFilter();

        expect(store.filter.status).toBe("all");
        expect(store.filter.priority).toBe("all");
        expect(store.filter.keyword).toBe("");
      });
    });

    describe("setSortBy", () => {
      it("should update sortBy", () => {
        store.setSortBy("dueDate");

        expect(store.sortBy).toBe("dueDate");
      });
    });

    describe("setWeeklyVelocity", () => {
      it("should update weeklyVelocityHours", () => {
        store.setWeeklyVelocity(40);

        expect(store.weeklyVelocityHours).toBe(40);
      });

      it("should round and clamp value", () => {
        store.setWeeklyVelocity(45.7);

        expect(store.weeklyVelocityHours).toBe(46);
      });

      it("should handle NaN", () => {
        store.setWeeklyVelocity(NaN);

        expect(store.weeklyVelocityHours).toBe(0);
      });
    });

    describe("addTask", () => {
      it("should add task to beginning of list", () => {
        store.tasks = [];
        const task = store.addTask(createTaskInput({ title: "New Task" }));

        expect(store.tasks.length).toBe(1);
        expect(store.tasks[0].title).toBe("New Task");
        expect(store.tasks[0]).toEqual(task);
      });

      it("should normalize task input", () => {
        const task = store.addTask({ title: "  Padded Title  " });

        expect(task.title).toBe("Padded Title");
      });
    });

    describe("updateTask", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1", title: "Original" })] as TaskItem[];
      });

      it("should update existing task", () => {
        const updated = store.updateTask("t1", { title: "Updated" });

        expect(updated?.title).toBe("Updated");
        expect(store.tasks[0].title).toBe("Updated");
      });

      it("should return undefined for non-existent task", () => {
        const result = store.updateTask("non-existent", { title: "Updated" });

        expect(result).toBeUndefined();
      });

      it("should update updatedAt timestamp", () => {
        const before = store.tasks[0].updatedAt;
        store.updateTask("t1", { title: "Updated" });

        expect(store.tasks[0].updatedAt).not.toBe(before);
      });
    });

    describe("removeTask", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1" }), createTaskInput({ id: "t2" })] as TaskItem[];
      });

      it("should remove task", () => {
        const result = store.removeTask("t1");

        expect(result).toBe(true);
        expect(store.tasks.length).toBe(1);
      });

      it("should remove from selectedTaskIds", () => {
        store.selectedTaskIds = ["t1", "t2"];
        store.removeTask("t1");

        expect(store.selectedTaskIds).not.toContain("t1");
      });

      it("should return false for non-existent task", () => {
        const result = store.removeTask("non-existent");

        expect(result).toBe(false);
      });
    });

    describe("archiveTask", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1", archived: false })] as TaskItem[];
      });

      it("should set archived to true", () => {
        const result = store.archiveTask("t1");

        expect(result).toBe(true);
        expect(store.tasks[0].archived).toBe(true);
      });

      it("should return false for non-existent task", () => {
        const result = store.archiveTask("non-existent");

        expect(result).toBe(false);
      });
    });

    describe("setTaskStatus", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1", status: "todo", estimateHours: 10, actualHours: 0 })] as TaskItem[];
      });

      it("should update status", () => {
        const result = store.setTaskStatus("t1", "in_progress");

        expect(result).toBe(true);
        expect(store.tasks[0].status).toBe("in_progress");
      });

      it("should set actualHours to estimateHours when done", () => {
        store.setTaskStatus("t1", "done");

        expect(store.tasks[0].actualHours).toBe(10);
      });

      it("should return false for non-existent task", () => {
        const result = store.setTaskStatus("non-existent", "done");

        expect(result).toBe(false);
      });
    });

    describe("setTaskReviewer", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1" })] as TaskItem[];
      });

      it("should set reviewer", () => {
        store.setTaskReviewer("t1", "Reviewer Name");

        expect(store.tasks[0].reviewer).toBe("Reviewer Name");
      });

      it("should trim reviewer name", () => {
        store.setTaskReviewer("t1", "  Reviewer  ");

        expect(store.tasks[0].reviewer).toBe("Reviewer");
      });

      it("should set to undefined for empty string", () => {
        store.tasks[0].reviewer = "Existing";
        store.setTaskReviewer("t1", "   ");

        expect(store.tasks[0].reviewer).toBeUndefined();
      });
    });

    describe("setTaskBlockedReason", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1" })] as TaskItem[];
      });

      it("should set blockedReason", () => {
        store.setTaskBlockedReason("t1", "Waiting for API");

        expect(store.tasks[0].blockedReason).toBe("Waiting for API");
      });
    });

    describe("transitionTask", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1", status: "todo" })] as TaskItem[];
      });

      it("should transition task status when allowed", () => {
        const result = store.transitionTask("t1", "in_progress", createContext({ actorRole: "owner" }));

        expect(result.allowed).toBe(true);
        expect(store.tasks[0].status).toBe("in_progress");
      });

      it("should create workflow log", () => {
        store.transitionTask("t1", "in_progress", createContext({ actorId: "user-1" }));

        expect(store.workflowLogs.length).toBe(1);
        expect(store.workflowLogs[0].taskId).toBe("t1");
        expect(store.workflowLogs[0].from).toBe("todo");
        expect(store.workflowLogs[0].to).toBe("in_progress");
      });

      it("should return decision for non-existent task", () => {
        const result = store.transitionTask("non-existent", "in_progress", createContext());

        expect(result.allowed).toBe(false);
        expect(result.code).toBe("invalid_transition");
      });

      it("should not transition when not allowed", () => {
        const result = store.transitionTask("t1", "blocked", createContext({ actorRole: "member" }));

        expect(result.allowed).toBe(false);
        expect(store.tasks[0].status).toBe("todo");
      });

      it("should limit workflow logs to 100", () => {
        for (let i = 0; i < 150; i++) {
          store.tasks[0].status = "todo";
          store.transitionTask("t1", "in_progress", createContext());
          store.tasks[0].status = "todo";
        }

        expect(store.workflowLogs.length).toBe(100);
      });
    });

    describe("toggleSelectTask", () => {
      beforeEach(() => {
        store.tasks = [createTaskInput({ id: "t1" }), createTaskInput({ id: "t2" })] as TaskItem[];
      });

      it("should add to selection when not selected", () => {
        store.toggleSelectTask("t1");

        expect(store.selectedTaskIds).toContain("t1");
      });

      it("should remove from selection when already selected", () => {
        store.selectedTaskIds = ["t1"];
        store.toggleSelectTask("t1");

        expect(store.selectedTaskIds).not.toContain("t1");
      });
    });

    describe("selectTasks", () => {
      it("should set selectedTaskIds", () => {
        store.selectTasks(["t1", "t2", "t1"]);

        expect(store.selectedTaskIds).toEqual(["t1", "t2"]);
      });
    });

    describe("clearSelection", () => {
      it("should clear selectedTaskIds", () => {
        store.selectedTaskIds = ["t1", "t2"];
        store.clearSelection();

        expect(store.selectedTaskIds).toEqual([]);
      });
    });

    describe("reassignTasks", () => {
      beforeEach(() => {
        store.tasks = [
          createTaskInput({ id: "t1", assignee: "Alice" }),
          createTaskInput({ id: "t2", assignee: "Bob" }),
          createTaskInput({ id: "t3", assignee: "Charlie" })
        ] as TaskItem[];
      });

      it("should reassign specified tasks", () => {
        const count = store.reassignTasks(["t1", "t2"], "New Assignee");

        expect(count).toBe(2);
        expect(store.tasks[0].assignee).toBe("New Assignee");
        expect(store.tasks[1].assignee).toBe("New Assignee");
        expect(store.tasks[2].assignee).toBe("Charlie");
      });
    });

    describe("bulkArchive", () => {
      beforeEach(() => {
        store.tasks = [
          createTaskInput({ id: "t1", archived: false }),
          createTaskInput({ id: "t2", archived: false }),
          createTaskInput({ id: "t3", archived: true })
        ] as TaskItem[];
      });

      it("should archive specified tasks", () => {
        const count = store.bulkArchive(["t1", "t2"]);

        expect(count).toBe(2);
        expect(store.tasks[0].archived).toBe(true);
        expect(store.tasks[1].archived).toBe(true);
      });

      it("should not count already archived tasks", () => {
        const count = store.bulkArchive(["t1", "t3"]);

        expect(count).toBe(1);
      });

      it("should use selectedTaskIds when no ids provided", () => {
        store.selectedTaskIds = ["t1"];
        const count = store.bulkArchive();

        expect(count).toBe(1);
      });

      it("should remove archived tasks from selection", () => {
        store.selectedTaskIds = ["t1", "t2"];
        store.bulkArchive(["t1"]);

        expect(store.selectedTaskIds).not.toContain("t1");
      });
    });

    describe("clearDone", () => {
      beforeEach(() => {
        store.tasks = [
          createTaskInput({ id: "t1", status: "done" }),
          createTaskInput({ id: "t2", status: "todo" }),
          createTaskInput({ id: "t3", status: "done", archived: true })
        ] as TaskItem[];
      });

      it("should remove done tasks", () => {
        const count = store.clearDone();

        expect(count).toBe(1);
        expect(store.tasks.find(t => t.id === "t1")).toBeUndefined();
      });

      it("should include archived when flag is set", () => {
        const count = store.clearDone(true);

        expect(count).toBe(2);
      });
    });

    describe("importTasks", () => {
      it("should replace all tasks in replace mode", () => {
        store.tasks = [createTaskInput({ id: "old" })] as TaskItem[];
        const count = store.importTasks([createTaskInput({ id: "new" })], "replace");

        expect(count).toBe(1);
        expect(store.tasks.length).toBe(1);
        expect(store.tasks[0].id).toBe("new");
      });

      it("should merge tasks in merge mode", () => {
        store.tasks = [createTaskInput({ id: "t1", title: "Original" })] as TaskItem[];
        const count = store.importTasks([
          createTaskInput({ id: "t1", title: "Updated" }),
          createTaskInput({ id: "t2", title: "New" })
        ], "merge");

        expect(count).toBe(2);
        expect(store.tasks.length).toBe(2);
      });

      it("should clear selection in replace mode", () => {
        store.selectedTaskIds = ["t1"];
        store.importTasks([], "replace");

        expect(store.selectedTaskIds).toEqual([]);
      });
    });

    describe("draft management", () => {
      it("should save and apply draft", () => {
        store.tasks = [createTaskInput({ id: "t1", title: "Original" })] as TaskItem[];
        store.saveTaskDraft("t1", { title: "Draft Title" });
        const applied = store.applyTaskDraft("t1");

        expect(applied).toBe(true);
        expect(store.tasks[0].title).toBe("Draft Title");
      });

      it("should return false when draft does not exist", () => {
        const applied = store.applyTaskDraft("non-existent");

        expect(applied).toBe(false);
      });

      it("should clear draft", () => {
        store.saveTaskDraft("t1", { title: "Draft" });
        store.clearTaskDraft("t1");

        expect(store.listTaskDraftIds()).not.toContain("t1");
      });
    });

    describe("syncTasks", () => {
      it("should update syncState on success", async () => {
        const syncer = vi.fn().mockResolvedValue({ ok: true });
        const result = await store.syncTasks(syncer);

        expect(result).toBe(true);
        expect(store.syncState).toBe("success");
      });

      it("should update syncState on failure", async () => {
        const syncer = vi.fn().mockResolvedValue({ ok: false, error: "Sync failed" });
        const result = await store.syncTasks(syncer);

        expect(result).toBe(false);
        expect(store.syncState).toBe("failed");
        expect(store.syncError).toBe("Sync failed");
      });

      it("should handle exceptions", async () => {
        const syncer = vi.fn().mockRejectedValue(new Error("Network error"));
        const result = await store.syncTasks(syncer);

        expect(result).toBe(false);
        expect(store.syncState).toBe("failed");
        expect(store.syncError).toBe("Network error");
      });

      it("should use default syncer when not provided", async () => {
        const result = await store.syncTasks();

        expect(result).toBe(true);
        expect(store.syncState).toBe("success");
      });
    });

    describe("resetState", () => {
      it("should reset all state to initial values", () => {
        store.filter = { status: "done", keyword: "test" } as TaskFilter;
        store.sortBy = "dueDate";
        store.selectedTaskIds = ["t1"];
        store.workflowLogs = [{} as any];
        store.weeklyVelocityHours = 50;
        store.syncState = "failed";
        store.syncError = "Error";

        store.resetState();

        expect(store.filter.status).toBe("all");
        expect(store.sortBy).toBe("priority");
        expect(store.selectedTaskIds).toEqual([]);
        expect(store.workflowLogs).toEqual([]);
        expect(store.weeklyVelocityHours).toBe(34);
        expect(store.syncState).toBe("idle");
        expect(store.syncError).toBe("");
      });
    });
  });
});
