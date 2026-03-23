import { describe, it, expect, vi } from "vitest";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/task";
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
import { formatDate } from "@/utils/date";

describe("任务工具函数", () => {
  const today = formatDate(new Date());

  describe("normalizeTask", () => {
    it("应使用默认值填充缺失字段", () => {
      const input = { title: "Test Task" };
      const result = normalizeTask(input);
      
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Test Task");
      expect(result.description).toBe("");
      expect(result.priority).toBe("medium");
      expect(result.status).toBe("todo");
      expect(result.assignee).toBe("Unassigned");
      expect(result.dueDate).toBe(today);
      expect(result.createdAt).toBe(today);
      expect(result.updatedAt).toBe(today);
      expect(result.tags).toEqual([]);
      expect(result.estimateHours).toBe(0);
      expect(result.actualHours).toBe(0);
      expect(result.blockedReason).toBe("");
      expect(result.reviewer).toBeUndefined();
      expect(result.dependencies).toEqual([]);
      expect(result.sprint).toBeUndefined();
      expect(result.archived).toBe(false);
    });

    it("应保留提供的字段值", () => {
      const input: Partial<TaskItem> = {
        id: "custom-id",
        title: "  Custom Title  ",
        description: "  Description  ",
        priority: "high",
        status: "in_progress",
        assignee: "  John Doe  ",
        dueDate: "2024-12-31",
        tags: ["tag1", "tag2", "tag1"],
        estimateHours: 8,
        actualHours: 2,
        reviewer: "  Jane Smith  ",
        dependencies: ["dep1", "dep2", "dep1"],
        sprint: "Sprint 1",
        archived: true
      };
      
      const result = normalizeTask(input);
      
      expect(result.id).toBe("custom-id");
      expect(result.title).toBe("Custom Title");
      expect(result.description).toBe("Description");
      expect(result.priority).toBe("high");
      expect(result.status).toBe("in_progress");
      expect(result.assignee).toBe("John Doe");
      expect(result.dueDate).toBe("2024-12-31");
      expect(result.tags).toEqual(["tag1", "tag2"]);
      expect(result.estimateHours).toBe(8);
      expect(result.actualHours).toBe(2);
      expect(result.reviewer).toBe("Jane Smith");
      expect(result.dependencies).toEqual(["dep1", "dep2"]);
      expect(result.sprint).toBe("Sprint 1");
      expect(result.archived).toBe(true);
    });

    it("应在标题为空时使用默认标题", () => {
      const input = { title: "" };
      const result = normalizeTask(input);
      expect(result.title).toBe("Untitled Task");
    });

    it("应使用fallback值填充缺失字段", () => {
      const input = { title: "Test" };
      const fallback = { assignee: "Default Assignee", priority: "low" as TaskPriority };
      const result = normalizeTask(input, fallback);
      expect(result.title).toBe("Test");
      expect(result.assignee).toBe("Default Assignee");
      expect(result.priority).toBe("low");
    });

    it("应确保工时不小于0", () => {
      const input = { estimateHours: -5, actualHours: -3 };
      const result = normalizeTask(input);
      expect(result.estimateHours).toBe(0);
      expect(result.actualHours).toBe(0);
    });

    it("空 assignee 应返回 'Unassigned'", () => {
      const input = { assignee: "   " };
      const result = normalizeTask(input);
      expect(result.assignee).toBe("Unassigned");
    });

    it("空 blockedReason 应返回 ''", () => {
      const input = { blockedReason: "   " };
      const result = normalizeTask(input);
      expect(result.blockedReason).toBe("");
    });
  });

  describe("comparePriority", () => {
    it("应正确比较优先级顺序", () => {
      expect(comparePriority("urgent", "low")).toBeGreaterThan(0);
      expect(comparePriority("high", "medium")).toBeGreaterThan(0);
      expect(comparePriority("medium", "low")).toBeGreaterThan(0);
      expect(comparePriority("low", "urgent")).toBeLessThan(0);
      expect(comparePriority("medium", "medium")).toBe(0);
    });
  });

  describe("sortTasks", () => {
    const tasks: TaskItem[] = [
      normalizeTask({ id: "1", title: "B Task", priority: "low", dueDate: "2024-01-20", status: "todo", updatedAt: "2024-01-15" }),
      normalizeTask({ id: "2", title: "A Task", priority: "high", dueDate: "2024-01-15", status: "in_progress", updatedAt: "2024-01-20" }),
      normalizeTask({ id: "3", title: "C Task", priority: "medium", dueDate: "2024-01-10", status: "done", updatedAt: "2024-01-10" })
    ];

    it("应按优先级排序", () => {
      const result = sortTasks(tasks, "priority");
      expect(result[0].priority).toBe("high");
      expect(result[1].priority).toBe("medium");
      expect(result[2].priority).toBe("low");
    });

    it("应按截止日期排序", () => {
      const result = sortTasks(tasks, "dueDate");
      expect(result[0].dueDate).toBe("2024-01-10");
      expect(result[1].dueDate).toBe("2024-01-15");
      expect(result[2].dueDate).toBe("2024-01-20");
    });

    it("应按状态排序", () => {
      const result = sortTasks(tasks, "status");
      expect(result[0].status).toBe("todo");
      expect(result[1].status).toBe("in_progress");
      expect(result[2].status).toBe("done");
    });

    it("应按标题字母顺序排序", () => {
      const result = sortTasks(tasks, "title");
      expect(result[0].title).toBe("A Task");
      expect(result[1].title).toBe("B Task");
      expect(result[2].title).toBe("C Task");
    });

    it("应按更新日期排序", () => {
      const result = sortTasks(tasks, "updatedAt");
      expect(result[0].updatedAt).toBe("2024-01-10");
      expect(result[1].updatedAt).toBe("2024-01-15");
      expect(result[2].updatedAt).toBe("2024-01-20");
    });

    it("应默认按优先级排序", () => {
      const result = sortTasks(tasks);
      expect(result[0].priority).toBe("high");
    });

    it("不应修改原数组", () => {
      const original = [...tasks];
      sortTasks(tasks, "title");
      expect(tasks).toEqual(original);
    });
  });

  describe("filterTasks", () => {
    const tasks: TaskItem[] = [
      normalizeTask({ id: "1", title: "Bug Fix", status: "todo", priority: "high", assignee: "John", tags: ["bug"], archived: false }),
      normalizeTask({ id: "2", title: "Feature", status: "in_progress", priority: "medium", assignee: "Jane", tags: ["feature"], archived: false }),
      normalizeTask({ id: "3", title: "Review", status: "done", priority: "low", assignee: "John", tags: ["review"], archived: false }),
      normalizeTask({ id: "4", title: "Old Task", status: "todo", priority: "low", assignee: "John", tags: [], archived: true })
    ];

    it("应按状态过滤", () => {
      const result = filterTasks(tasks, { status: "todo" });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("todo");
    });

    it("应按优先级过滤", () => {
      const result = filterTasks(tasks, { priority: "high" });
      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe("high");
    });

    it("应按负责人过滤", () => {
      const result = filterTasks(tasks, { assignee: "John" });
      expect(result).toHaveLength(2);
      expect(result.every(t => t.assignee === "John")).toBe(true);
    });

    it("应按关键词过滤", () => {
      const result = filterTasks(tasks, { keyword: "bug" });
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("Bug");
    });

    it("应包含已归档任务", () => {
      const result = filterTasks(tasks, { includeArchived: true });
      expect(result).toHaveLength(4);
    });

    it("应排除已归档任务（默认）", () => {
      const result = filterTasks(tasks, {});
      expect(result).toHaveLength(3);
    });

    it("应过滤已过期任务", () => {
      const overdueTask = normalizeTask({ id: "5", title: "Overdue", dueDate: "2020-01-01", status: "todo" });
      const allTasks = [...tasks, overdueTask];
      const result = filterTasks(allTasks, { overdueOnly: true });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Overdue");
    });

    it("应使用'all'状态不过滤", () => {
      const result = filterTasks(tasks, { status: "all" });
      expect(result).toHaveLength(3);
    });

    it("关键词搜索应大小写不敏感", () => {
      const result = filterTasks(tasks, { keyword: "BUG" });
      expect(result).toHaveLength(1);
      expect(result[0].title).toContain("Bug");
    });

    it("多条件组合过滤 (status + priority)", () => {
      const result = filterTasks(tasks, { status: "todo", priority: "high" });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("todo");
      expect(result[0].priority).toBe("high");
    });
  });

  describe("groupByStatus", () => {
    it("应按状态分组任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo" }),
        normalizeTask({ status: "in_progress" }),
        normalizeTask({ status: "done" }),
        normalizeTask({ status: "todo" })
      ];
      
      const result = groupByStatus(tasks);
      
      expect(result.todo).toHaveLength(2);
      expect(result.in_progress).toHaveLength(1);
      expect(result.done).toHaveLength(1);
      expect(result.review).toHaveLength(0);
      expect(result.blocked).toHaveLength(0);
    });

    it("应在无任务时返回空数组", () => {
      const result = groupByStatus([]);
      expect(result.todo).toEqual([]);
      expect(result.in_progress).toEqual([]);
      expect(result.done).toEqual([]);
      expect(result.review).toEqual([]);
      expect(result.blocked).toEqual([]);
    });
  });

  describe("calculateTaskStats", () => {
    it("应正确计算任务统计", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo" }),
        normalizeTask({ status: "in_progress" }),
        normalizeTask({ status: "review" }),
        normalizeTask({ status: "blocked" }),
        normalizeTask({ status: "done" }),
        normalizeTask({ status: "done", archived: true })
      ];
      
      const today = new Date("2024-01-15");
      const result = calculateTaskStats(tasks, today);
      
      expect(result.total).toBe(5);
      expect(result.done).toBe(1);
      expect(result.review).toBe(1);
      expect(result.blocked).toBe(1);
      expect(result.overdue).toBe(0);
      expect(result.archived).toBe(1);
      expect(result.progress).toBe(20);
    });

    it("应在无活动任务时返回0进度", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "done", archived: true })
      ];
      
      const result = calculateTaskStats(tasks);
      expect(result.total).toBe(0);
      expect(result.progress).toBe(0);
    });

    it("应正确识别过期任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", dueDate: "2024-01-10" }),
        normalizeTask({ status: "done", dueDate: "2024-01-10" })
      ];
      
      const today = new Date("2024-01-15");
      const result = calculateTaskStats(tasks, today);
      
      expect(result.overdue).toBe(1);
    });
  });

  describe("pickNextActionableTask", () => {
    it("应返回下一个应处理的任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", status: "todo", priority: "low", dueDate: "2024-01-20" }),
        normalizeTask({ id: "2", status: "todo", priority: "high", dueDate: "2024-01-15" }),
        normalizeTask({ id: "3", status: "done", priority: "urgent", dueDate: "2024-01-10" })
      ];
      
      const result = pickNextActionableTask(tasks);
      expect(result?.id).toBe("2");
    });

    it("应在无可用任务时返回undefined", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "done" }),
        normalizeTask({ status: "done", archived: true })
      ];
      
      const result = pickNextActionableTask(tasks);
      expect(result).toBeUndefined();
    });
  });

  describe("collectTags", () => {
    it("应收集所有唯一标签并排序", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ tags: ["zebra", "apple"] }),
        normalizeTask({ tags: ["banana", "apple"] }),
        normalizeTask({ tags: ["cherry"] })
      ];
      
      const result = collectTags(tasks);
      expect(result).toEqual(["apple", "banana", "cherry", "zebra"]);
    });

    it("应在无任务时返回空数组", () => {
      const result = collectTags([]);
      expect(result).toEqual([]);
    });
  });

  describe("estimateWorkloadByAssignee", () => {
    it("应按负责人估算剩余工作量", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ assignee: "John", status: "todo", estimateHours: 8, actualHours: 2 }),
        normalizeTask({ assignee: "John", status: "in_progress", estimateHours: 4, actualHours: 3 }),
        normalizeTask({ assignee: "Jane", status: "todo", estimateHours: 10, actualHours: 0 }),
        normalizeTask({ assignee: "John", status: "done", estimateHours: 5, actualHours: 5 })
      ];
      
      const result = estimateWorkloadByAssignee(tasks);
      expect(result["John"]).toBe(7);
      expect(result["Jane"]).toBe(10);
    });

    it("应确保剩余工时不小于0", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ assignee: "John", status: "todo", estimateHours: 4, actualHours: 6 })
      ];
      
      const result = estimateWorkloadByAssignee(tasks);
      expect(result["John"]).toBe(0);
    });
  });

  describe("validateDependencies", () => {
    it("应检测缺失的依赖", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", dependencies: ["missing-id"] })
      ];
      
      const result = validateDependencies(tasks);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].taskId).toBe("1");
      expect(result.missing[0].dependencyId).toBe("missing-id");
    });

    it("应检测循环依赖", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", dependencies: ["2"] }),
        normalizeTask({ id: "2", dependencies: ["3"] }),
        normalizeTask({ id: "3", dependencies: ["1"] })
      ];
      
      const result = validateDependencies(tasks);
      expect(result.circular).toHaveLength(1);
    });

    it("应在无依赖问题时返回空结果", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", dependencies: [] }),
        normalizeTask({ id: "2", dependencies: ["1"] })
      ];
      
      const result = validateDependencies(tasks);
      expect(result.missing).toHaveLength(0);
      expect(result.circular).toHaveLength(0);
    });

    it("自引用依赖应检测为循环依赖", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", dependencies: ["1"] })
      ];
      
      const result = validateDependencies(tasks);
      expect(result.circular).toHaveLength(1);
      expect(result.circular[0]).toContain("1");
    });
  });

  describe("mergeTaskPatch", () => {
    it("应合并任务补丁并更新updatedAt", () => {
      const task = normalizeTask({
        id: "1",
        title: "Original Title",
        description: "Original Description",
        priority: "medium"
      });
      
      const patch = {
        title: "New Title",
        priority: "high" as TaskPriority
      };
      
      const result = mergeTaskPatch(task, patch);
      
      expect(result.id).toBe("1");
      expect(result.title).toBe("New Title");
      expect(result.description).toBe("Original Description");
      expect(result.priority).toBe("high");
      expect(result.updatedAt).toBe(today);
    });

    it("应返回标准化的任务对象", () => {
      const task = normalizeTask({ id: "1", title: "Test" });
      const patch = { title: "" };
      
      const result = mergeTaskPatch(task, patch);
      expect(result.title).toBe("Untitled Task");
    });
  });
});
