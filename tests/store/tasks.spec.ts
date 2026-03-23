import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTaskStore } from "@/store/modules/tasks";
import type { TaskStatus } from "@/types/task";
import type { WorkflowContext } from "@/types/workflow";

describe("Tasks Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("初始状态", () => {
    it("应初始化时包含mock任务数据", () => {
      const store = useTaskStore();
      expect(store.tasks).toBeDefined();
      expect(store.tasks.length).toBeGreaterThan(0);
      expect(store.filter).toBeDefined();
      expect(store.sortBy).toBe("priority");
      expect(store.selectedTaskIds).toEqual([]);
      expect(store.workflowLogs).toEqual([]);
      expect(store.weeklyVelocityHours).toBe(34);
      expect(store.syncState).toBe("idle");
      expect(store.syncError).toBe("");
    });
  });

  describe("Getters", () => {
    it("visibleTasks应返回过滤并排序后的任务", () => {
      const store = useTaskStore();
      const initialCount = store.visibleTasks.length;
      
      store.filter = { ...store.filter, status: "done" };
      
      expect(store.visibleTasks.length).toBeLessThanOrEqual(initialCount);
      expect(store.visibleTasks.every(task => task.status === "done")).toBe(true);
    });

    it("groupedVisibleTasks应按状态分组可见任务", () => {
      const store = useTaskStore();
      const grouped = store.groupedVisibleTasks;
      
      expect(grouped).toHaveProperty("todo");
      expect(grouped).toHaveProperty("in_progress");
      expect(grouped).toHaveProperty("review");
      expect(grouped).toHaveProperty("blocked");
      expect(grouped).toHaveProperty("done");
    });

    it("stats应返回正确的统计数据", () => {
      const store = useTaskStore();
      const stats = store.stats;
      
      expect(stats.total).toBeDefined();
      expect(stats.done).toBeDefined();
      expect(stats.progress).toBeDefined();
      expect(stats.overdue).toBeDefined();
    });

    it("assigneeList应返回唯一的负责人列表", () => {
      const store = useTaskStore();
      const assignees = store.assigneeList;
      
      expect(Array.isArray(assignees)).toBe(true);
      expect(new Set(assignees).size).toBe(assignees.length);
    });

    it("nextTask应返回下一个应处理的任务", () => {
      const store = useTaskStore();
      const nextTask = store.nextTask;
      
      if (nextTask) {
        expect(nextTask.status).not.toBe("done");
        expect(nextTask.archived).toBe(false);
      }
    });

    it("selectedTasks应返回选中的任务", () => {
      const store = useTaskStore();
      const taskId = store.tasks[0]?.id;
      
      if (taskId) {
        store.selectedTaskIds = [taskId];
        expect(store.selectedTasks).toHaveLength(1);
        expect(store.selectedTasks[0].id).toBe(taskId);
      }
    });

    it("workloadByAssignee应按负责人估算工作量", () => {
      const store = useTaskStore();
      const workload = store.workloadByAssignee;
      
      expect(typeof workload).toBe("object");
    });

    it("topRiskTasks应返回风险最高的前5个任务", () => {
      const store = useTaskStore();
      const topTasks = store.topRiskTasks;
      
      expect(topTasks.length).toBeLessThanOrEqual(5);
    });

    it("dependencyIssues应返回依赖问题", () => {
      const store = useTaskStore();
      const issues = store.dependencyIssues;
      
      expect(issues).toHaveProperty("missing");
      expect(issues).toHaveProperty("circular");
    });

    it("slaSnapshot应返回SLA状态快照", () => {
      const store = useTaskStore();
      const sla = store.slaSnapshot;
      
      expect(sla).toHaveProperty("healthy");
      expect(sla).toHaveProperty("warning");
      expect(sla).toHaveProperty("danger");
    });

    it("deliveryForecast应返回交付预测", () => {
      const store = useTaskStore();
      const forecast = store.deliveryForecast;
      
      expect(forecast).toHaveProperty("remainingHours");
      expect(forecast).toHaveProperty("weeksNeeded");
      expect(forecast).toHaveProperty("etaDate");
    });
  });

  describe("Actions", () => {
    describe("setFilter", () => {
      it("应更新过滤器", () => {
        const store = useTaskStore();
        const newFilter = { status: "in_progress" as TaskStatus | "all" };
        
        store.setFilter(newFilter);
        
        expect(store.filter.status).toBe("in_progress");
      });

      it("应合并新过滤器与现有过滤器", () => {
        const store = useTaskStore();
        store.setFilter({ status: "todo" });
        store.setFilter({ assignee: "John" });
        
        expect(store.filter.status).toBe("todo");
        expect(store.filter.assignee).toBe("John");
      });
    });

    describe("resetFilter", () => {
      it("应重置过滤器为初始状态", () => {
        const store = useTaskStore();
        store.setFilter({ status: "done", assignee: "John" });
        
        store.resetFilter();
        
        expect(store.filter.status).toBe("all");
        expect(store.filter.assignee).toBe("");
      });
    });

    describe("setSortBy", () => {
      it("应更新排序方式", () => {
        const store = useTaskStore();
        
        store.setSortBy("dueDate");
        
        expect(store.sortBy).toBe("dueDate");
      });
    });

    describe("setWeeklyVelocity", () => {
      it("应设置每周速度", () => {
        const store = useTaskStore();
        
        store.setWeeklyVelocity(40);
        
        expect(store.weeklyVelocityHours).toBe(40);
      });

      it("应确保速度值有效", () => {
        const store = useTaskStore();
        
        store.setWeeklyVelocity(-10);
        expect(store.weeklyVelocityHours).toBe(0);
        
        store.setWeeklyVelocity(NaN);
        expect(store.weeklyVelocityHours).toBe(0);
        
        store.setWeeklyVelocity(35.6);
        expect(store.weeklyVelocityHours).toBe(36);
      });
    });

    describe("addTask", () => {
      it("应添加新任务", () => {
        const store = useTaskStore();
        const initialCount = store.tasks.length;
        
        const newTask = store.addTask({ title: "New Test Task" });
        
        expect(store.tasks.length).toBe(initialCount + 1);
        expect(newTask.title).toBe("New Test Task");
        expect(newTask.id).toBeDefined();
      });

      it("应将新任务添加到列表开头", () => {
        const store = useTaskStore();
        
        store.addTask({ title: "First Task" });
        
        expect(store.tasks[0].title).toBe("First Task");
      });
    });

    describe("updateTask", () => {
      it("应更新现有任务", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Original Title" });
        
        const updated = store.updateTask(task.id, { title: "Updated Title" });
        
        expect(updated?.title).toBe("Updated Title");
        expect(store.tasks.find(t => t.id === task.id)?.title).toBe("Updated Title");
      });

      it("任务不存在时应返回undefined", () => {
        const store = useTaskStore();
        
        const result = store.updateTask("non-existent-id", { title: "Test" });
        
        expect(result).toBeUndefined();
      });
    });

    describe("removeTask", () => {
      it("应删除现有任务", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "To Be Removed" });
        const initialCount = store.tasks.length;
        
        const result = store.removeTask(task.id);
        
        expect(result).toBe(true);
        expect(store.tasks.length).toBe(initialCount - 1);
      });

      it("删除任务时应从选中列表移除", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "To Be Removed" });
        store.selectedTaskIds = [task.id];
        
        store.removeTask(task.id);
        
        expect(store.selectedTaskIds.includes(task.id)).toBe(false);
      });

      it("任务不存在时应返回false", () => {
        const store = useTaskStore();
        
        const result = store.removeTask("non-existent-id");
        
        expect(result).toBe(false);
      });
    });

    describe("archiveTask", () => {
      it("应归档现有任务", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "To Be Archived" });
        
        const result = store.archiveTask(task.id);
        
        expect(result).toBe(true);
        expect(store.tasks.find(t => t.id === task.id)?.archived).toBe(true);
      });

      it("应更新任务的updatedAt字段", () => {
        const store = useTaskStore();
        // 创建一个旧日期的任务
        const pastDate = "2024-01-01";
        const task = store.addTask({ title: "Test Task", updatedAt: pastDate });
        expect(task.updatedAt).toBe(pastDate);
        
        store.archiveTask(task.id);
        
        // 归档后updatedAt应更新为当前日期（不等于过去的日期）
        const updatedTask = store.tasks.find(t => t.id === task.id);
        expect(updatedTask?.updatedAt).not.toBe(pastDate);
      });

      it("任务不存在时应返回false", () => {
        const store = useTaskStore();
        
        const result = store.archiveTask("non-existent-id");
        
        expect(result).toBe(false);
      });
    });

    describe("setTaskStatus", () => {
      it("应设置任务状态", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task", status: "todo" });
        
        const result = store.setTaskStatus(task.id, "in_progress");
        
        expect(result).toBe(true);
        expect(store.tasks.find(t => t.id === task.id)?.status).toBe("in_progress");
      });

      it("设置为完成时应自动填充实际工时", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task", status: "todo", estimateHours: 8, actualHours: 0 });
        
        store.setTaskStatus(task.id, "done");
        
        const updated = store.tasks.find(t => t.id === task.id);
        expect(updated?.status).toBe("done");
        expect(updated?.actualHours).toBe(8);
      });

      it("任务不存在时应返回false", () => {
        const store = useTaskStore();
        
        const result = store.setTaskStatus("non-existent-id", "done");
        
        expect(result).toBe(false);
      });
    });

    describe("setTaskReviewer", () => {
      it("应设置任务审核人", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task" });
        
        const result = store.setTaskReviewer(task.id, "  John Doe  ");
        
        expect(result).toBe(true);
        expect(store.tasks.find(t => t.id === task.id)?.reviewer).toBe("John Doe");
      });

      it("应允许清除审核人", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task", reviewer: "John" });
        
        store.setTaskReviewer(task.id, "   ");
        
        expect(store.tasks.find(t => t.id === task.id)?.reviewer).toBeUndefined();
      });

      it("任务不存在时应返回false", () => {
        const store = useTaskStore();
        
        const result = store.setTaskReviewer("non-existent-id", "John");
        
        expect(result).toBe(false);
      });
    });

    describe("setTaskBlockedReason", () => {
      it("应设置阻塞原因", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task" });
        
        const result = store.setTaskBlockedReason(task.id, "  Waiting for input  ");
        
        expect(result).toBe(true);
        expect(store.tasks.find(t => t.id === task.id)?.blockedReason).toBe("Waiting for input");
      });

      it("任务不存在时应返回false", () => {
        const store = useTaskStore();
        
        const result = store.setTaskBlockedReason("non-existent-id", "Blocked");
        
        expect(result).toBe(false);
      });
    });

    describe("transitionTask", () => {
      it("应通过工作流规则验证后转换任务状态", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task", status: "todo" });
        const context: WorkflowContext = {
          actorId: "user-1",
          actorRole: "owner",
          note: "Started working"
        };
        
        const result = store.transitionTask(task.id, "in_progress", context);
        
        expect(result.allowed).toBe(true);
        expect(store.tasks.find(t => t.id === task.id)?.status).toBe("in_progress");
        expect(store.workflowLogs.length).toBeGreaterThan(0);
      });

      it("未通过验证时应拒绝状态转换", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task", status: "todo" });
        const context: WorkflowContext = {
          actorId: "user-1",
          actorRole: "member",
          note: "Trying to block"
        };
        
        const result = store.transitionTask(task.id, "blocked", context);
        
        expect(result.allowed).toBe(false);
        expect(result.code).toBe("forbidden_role");
      });

      it("任务不存在时应返回错误", () => {
        const store = useTaskStore();
        const context: WorkflowContext = {
          actorId: "user-1",
          actorRole: "owner",
          note: "Test"
        };
        
        const result = store.transitionTask("non-existent-id", "in_progress", context);
        
        expect(result.allowed).toBe(false);
        expect(result.code).toBe("invalid_transition");
      });

      it("应限制工作流日志数量在100条以内", () => {
        const store = useTaskStore();
        const context: WorkflowContext = {
          actorId: "user-1",
          actorRole: "owner",
          note: "Transition"
        };

        for (let i = 0; i < 150; i++) {
          const task = store.addTask({ title: `Task ${i}`, status: "todo" });
          store.transitionTask(task.id, "in_progress", context);
        }
        
        expect(store.workflowLogs.length).toBe(100);
      });
    });

    describe("toggleSelectTask", () => {
      it("应切换任务选中状态", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Test Task" });
        
        store.toggleSelectTask(task.id);
        expect(store.selectedTaskIds.includes(task.id)).toBe(true);
        
        store.toggleSelectTask(task.id);
        expect(store.selectedTaskIds.includes(task.id)).toBe(false);
      });
    });

    describe("selectTasks", () => {
      it("应批量选中任务", () => {
        const store = useTaskStore();
        const task1 = store.addTask({ title: "Task 1" });
        const task2 = store.addTask({ title: "Task 2" });
        
        store.selectTasks([task1.id, task2.id]);
        
        expect(store.selectedTaskIds).toEqual([task1.id, task2.id]);
      });

      it("应去重重复的ID", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Task 1" });
        
        store.selectTasks([task.id, task.id]);
        
        expect(store.selectedTaskIds).toEqual([task.id]);
      });
    });

    describe("clearSelection", () => {
      it("应清除所有选中", () => {
        const store = useTaskStore();
        const task = store.addTask({ title: "Task 1" });
        store.selectTasks([task.id]);
        
        store.clearSelection();
        
        expect(store.selectedTaskIds).toEqual([]);
      });
    });

    describe("reassignTasks", () => {
      it("应批量重新分配任务负责人", () => {
        const store = useTaskStore();
        const task1 = store.addTask({ title: "Task 1", assignee: "Old Assignee" });
        const task2 = store.addTask({ title: "Task 2", assignee: "Old Assignee" });
        
        const count = store.reassignTasks([task1.id, task2.id], "New Assignee");
        
        expect(count).toBe(2);
        expect(store.tasks.find(t => t.id === task1.id)?.assignee).toBe("New Assignee");
        expect(store.tasks.find(t => t.id === task2.id)?.assignee).toBe("New Assignee");
      });
    });

    describe("bulkArchive", () => {
      it("应批量归档选中的任务", () => {
        const store = useTaskStore();
        const task1 = store.addTask({ title: "Task 1" });
        const task2 = store.addTask({ title: "Task 2" });
        store.selectTasks([task1.id, task2.id]);
        
        const count = store.bulkArchive();
        
        expect(count).toBe(2);
        expect(store.tasks.find(t => t.id === task1.id)?.archived).toBe(true);
        expect(store.tasks.find(t => t.id === task2.id)?.archived).toBe(true);
        expect(store.selectedTaskIds).toEqual([]);
      });

      it("应只归档未归档的任务", () => {
        const store = useTaskStore();
        const task1 = store.addTask({ title: "Task 1", archived: true });
        const task2 = store.addTask({ title: "Task 2" });
        
        const count = store.bulkArchive([task1.id, task2.id]);
        
        expect(count).toBe(1);
      });
    });

    describe("clearDone", () => {
      it("应清除已完成的任务", () => {
        const store = useTaskStore();
        store.addTask({ title: "Done Task", status: "done" });
        store.addTask({ title: "Todo Task", status: "todo" });
        const initialCount = store.tasks.length;
        
        const cleared = store.clearDone();
        
        expect(cleared).toBeGreaterThan(0);
        expect(store.tasks.length).toBeLessThan(initialCount);
        // 验证清除成功：新添加的done任务被移除，原有mock数据保留
        const newDoneTasks = store.tasks.filter(t => t.title === "Done Task");
        expect(newDoneTasks.length).toBe(0);
        expect(cleared).toBeGreaterThan(0);
      });

      it("includeArchived为true时也应清除已归档且完成的任务", () => {
        const store = useTaskStore();
        store.addTask({ title: "Archived Done", status: "done", archived: true });
        const initialCount = store.tasks.length;
        
        const cleared = store.clearDone(true);
        
        expect(cleared).toBeGreaterThan(0);
      });
    });

    describe("importTasks", () => {
      it("应替换模式导入任务", () => {
        const store = useTaskStore();
        const newTasks = [
          { title: "Imported Task 1" },
          { title: "Imported Task 2" }
        ];
        
        const count = store.importTasks(newTasks, "replace");
        
        expect(count).toBe(2);
        expect(store.tasks.length).toBe(2);
      });

      it("应合并模式导入任务", () => {
        const store = useTaskStore();
        const existingTask = store.addTask({ title: "Existing Task" });
        const newTasks = [
          { id: existingTask.id, title: "Updated Task" },
          { title: "New Task" }
        ];
        
        const count = store.importTasks(newTasks, "merge");
        
        expect(count).toBe(2);
        expect(store.tasks.find(t => t.id === existingTask.id)?.title).toBe("Updated Task");
      });
    });

    describe("syncTasks", () => {
      it("成功同步时应更新状态", async () => {
        const store = useTaskStore();
        
        const result = await store.syncTasks();
        
        expect(result).toBe(true);
        expect(store.syncState).toBe("success");
        expect(store.syncError).toBe("");
      });

      it("同步失败时应设置错误状态", async () => {
        const store = useTaskStore();
        const failingSyncer = async () => ({ ok: false, error: "Sync failed" });
        
        const result = await store.syncTasks(failingSyncer);
        
        expect(result).toBe(false);
        expect(store.syncState).toBe("failed");
        expect(store.syncError).toBe("Sync failed");
      });

      it("应捕获同步异常", async () => {
        const store = useTaskStore();
        const errorSyncer = async () => { throw new Error("Network error"); };
        
        const result = await store.syncTasks(errorSyncer);
        
        expect(result).toBe(false);
        expect(store.syncState).toBe("failed");
        expect(store.syncError).toContain("Network error");
      });
    });

    describe("resetState", () => {
      it("应重置状态为初始值", () => {
        const store = useTaskStore();
        store.addTask({ title: "Custom Task" });
        store.setFilter({ status: "done" });
        store.selectedTaskIds = ["some-id"];
        
        store.resetState();
        
        expect(store.filter.status).toBe("all");
        expect(store.selectedTaskIds).toEqual([]);
        expect(store.syncState).toBe("idle");
        expect(store.syncError).toBe("");
      });
    });
  });

  describe("草稿功能", () => {
    it("应保存任务草稿", () => {
      const store = useTaskStore();
      const task = store.addTask({ title: "Test Task" });
      
      expect(() => store.saveTaskDraft(task.id, { title: "Draft Title" })).not.toThrow();
    });

    it("应应用任务草稿", () => {
      const store = useTaskStore();
      const task = store.addTask({ title: "Original Title" });
      store.saveTaskDraft(task.id, { title: "Draft Title" });
      
      const result = store.applyTaskDraft(task.id);
      
      expect(result).toBe(true);
    });

    it("应清除任务草稿", () => {
      const store = useTaskStore();
      const task = store.addTask({ title: "Test Task" });
      store.saveTaskDraft(task.id, { title: "Draft Title" });
      
      expect(() => store.clearTaskDraft(task.id)).not.toThrow();
    });

    it("应列出所有草稿ID", () => {
      const store = useTaskStore();
      
      const ids = store.listTaskDraftIds();
      
      expect(Array.isArray(ids)).toBe(true);
    });
  });
});
