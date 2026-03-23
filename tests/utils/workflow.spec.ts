import { describe, it, expect, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import type { UserRole, WorkflowContext } from "@/types/workflow";
import {
  getAllowedTransitions,
  evaluateTransition,
  createWorkflowLog,
  calculateTaskRisk,
  calculateSlaSnapshot,
  forecastDelivery,
  reorderByRisk
} from "@/utils/workflow";
import { normalizeTask } from "@/utils/task";
import { formatDate } from "@/utils/date";

describe("工作流工具函数", () => {
  describe("getAllowedTransitions", () => {
    it("应返回owner角色允许的所有转换", () => {
      const result = getAllowedTransitions("todo", "owner");
      expect(result).toContain("in_progress");
      expect(result).toContain("blocked");
    });

    it("应返回member角色允许的转换", () => {
      const result = getAllowedTransitions("todo", "member");
      expect(result).toContain("in_progress");
      expect(result).not.toContain("blocked");
    });

    it("应返回viewer角色允许的转换（空数组）", () => {
      const result = getAllowedTransitions("todo", "viewer");
      expect(result).toEqual([]);
    });

    it("应返回manager角色允许从review到done的转换", () => {
      const result = getAllowedTransitions("review", "manager");
      expect(result).toContain("done");
      expect(result).toContain("in_progress");
    });

    it("应不允许member角色从review到done的转换", () => {
      const result = getAllowedTransitions("review", "member");
      expect(result).not.toContain("done");
      expect(result).toContain("in_progress");
    });
  });

  describe("evaluateTransition", () => {
    it("应在状态未改变时拒绝转换", () => {
      const task = { status: "todo" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "todo", { actorRole: "owner" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("invalid_transition");
    });

    it("应拒绝不存在的状态转换", () => {
      const task = { status: "done" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "todo", { actorRole: "member" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("invalid_transition");
    });

    it("应基于角色权限拒绝转换", () => {
      const task = { status: "todo" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "blocked", { actorRole: "member" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("forbidden_role");
    });

    it("应在缺少阻塞原因时拒绝转换到blocked", () => {
      const task = { status: "todo" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "blocked", { actorRole: "owner" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("missing_block_reason");
    });

    it("应在缺少审核人时拒绝从review到done的转换", () => {
      const task = { status: "review" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "done", { actorRole: "owner" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("missing_reviewer");
    });

    it("应在有阻塞原因时允许转换到blocked", () => {
      const task = { status: "todo" as const, reviewer: undefined, blockedReason: "Waiting for input" };
      const result = evaluateTransition(task, "blocked", { actorRole: "owner" });
      expect(result.allowed).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("应在有审核人时允许从review到done的转换（任务上有审核人）", () => {
      const task = { status: "review" as const, reviewer: "John", blockedReason: "" };
      const result = evaluateTransition(task, "done", { actorRole: "owner" });
      expect(result.allowed).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("应在有审核人时允许从review到done的转换（上下文中有审核人）", () => {
      const task = { status: "review" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "done", { actorRole: "owner", reviewer: "John" });
      expect(result.allowed).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("应允许owner从done状态重新打开任务", () => {
      const task = { status: "done" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "in_progress", { actorRole: "owner" });
      expect(result.allowed).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("应拒绝member从done状态重新打开任务", () => {
      const task = { status: "done" as const, reviewer: undefined, blockedReason: "" };
      const result = evaluateTransition(task, "in_progress", { actorRole: "member" });
      expect(result.allowed).toBe(false);
      expect(result.code).toBe("forbidden_role");
    });
  });

  describe("createWorkflowLog", () => {
    it("应创建工作流日志条目", () => {
      const context: WorkflowContext = {
        actorId: "user_123",
        actorRole: "owner",
        note: "Completed the task",
        now: new Date("2024-01-15T14:30:00")
      };

      const result = createWorkflowLog("task_1", "in_progress", "done", context);

      expect(result.taskId).toBe("task_1");
      expect(result.from).toBe("in_progress");
      expect(result.to).toBe("done");
      expect(result.actorId).toBe("user_123");
      expect(result.actorRole).toBe("owner");
      expect(result.note).toBe("Completed the task");
      expect(result.at).toContain("2024-01-15");
      expect(result.at).toContain("14:30:00");
    });

    it("应处理空的备注", () => {
      const context: WorkflowContext = {
        actorId: "user_123",
        actorRole: "member",
        note: "  ",
        now: new Date("2024-01-15T14:30:00")
      };

      const result = createWorkflowLog("task_1", "todo", "in_progress", context);
      expect(result.note).toBe("");
    });
  });

  describe("calculateTaskRisk", () => {
    const today = new Date("2024-01-15");

    it("应计算紧急优先级任务的高风险", () => {
      const task = normalizeTask({
        priority: "urgent",
        status: "todo",
        dueDate: "2024-01-10",
        assignee: "Unassigned"
      });

      const result = calculateTaskRisk(task, today);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.factors).toContain("urgent-priority");
      expect(result.factors).toContain("overdue");
      expect(result.factors).toContain("unassigned");
    });

    it("应计算阻塞任务的额外风险", () => {
      const task = normalizeTask({
        priority: "medium",
        status: "blocked",
        dueDate: "2024-01-20",
        assignee: "John"
      });

      const result = calculateTaskRisk(task, today);
      expect(result.factors).toContain("blocked");
    });

    it("应降低已完成任务的风险", () => {
      const task = normalizeTask({
        priority: "urgent",
        status: "done",
        dueDate: "2024-01-10",
        assignee: "John"
      });

      const result = calculateTaskRisk(task, today);
      expect(result.factors).toContain("done");
      expect(result.score).toBeLessThan(50);
    });

    it("应检测工时超支", () => {
      const task = normalizeTask({
        priority: "medium",
        status: "in_progress",
        dueDate: "2024-01-20",
        assignee: "John",
        estimateHours: 10,
        actualHours: 15
      });

      const result = calculateTaskRisk(task, today);
      expect(result.factors).toContain("effort-overrun");
    });

    it("应将风险分数钳制在0-100范围内", () => {
      const task = normalizeTask({
        priority: "urgent",
        status: "blocked",
        dueDate: "2023-01-01",
        assignee: "Unassigned",
        estimateHours: 10,
        actualHours: 20
      });

      const result = calculateTaskRisk(task, today);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.level).toBe("critical");
    });

    it("应返回低优先级正常任务的低风险", () => {
      const task = normalizeTask({
        priority: "low",
        status: "todo",
        dueDate: "2024-02-01",
        assignee: "John"
      });

      const result = calculateTaskRisk(task, today);
      expect(result.level).toBe("low");
    });

    it("应正确分类风险等级", () => {
      const criticalTask = normalizeTask({ priority: "urgent", status: "blocked", dueDate: "2024-01-01" });
      const criticalResult = calculateTaskRisk(criticalTask, today);
      expect(criticalResult.level).toBe("critical");

      const highTask = normalizeTask({ priority: "high", status: "todo", dueDate: "2024-01-10" });
      const highResult = calculateTaskRisk(highTask, today);
      expect(highResult.level === "high" || highResult.level === "medium").toBe(true);

      const lowTask = normalizeTask({ priority: "low", status: "done", dueDate: "2024-02-01" });
      const lowResult = calculateTaskRisk(lowTask, today);
      expect(lowResult.level === "low" || lowResult.level === "medium").toBe(true);
    });
  });

  describe("calculateSlaSnapshot", () => {
    const today = new Date("2024-01-15");

    it("应计算SLA状态", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", dueDate: "2024-01-20", priority: "medium" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-14", priority: "medium" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-10", priority: "medium" }),
        normalizeTask({ status: "done", dueDate: "2024-01-01", priority: "high" })
      ];

      const result = calculateSlaSnapshot(tasks, today);
      expect(result.healthy).toBe(1);
      expect(result.warning + result.danger).toBe(2);
    });

    it("应基于优先级策略计算SLA", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", dueDate: "2024-01-14", priority: "urgent" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-14", priority: "high" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-14", priority: "medium" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-14", priority: "low" })
      ];

      const result = calculateSlaSnapshot(tasks, today);
      expect(result.healthy).toBe(0);
      expect(result.danger).toBeGreaterThanOrEqual(1);
    });

    it("应忽略已完成和已归档任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "done", dueDate: "2024-01-10", priority: "high" }),
        normalizeTask({ status: "todo", dueDate: "2024-01-10", priority: "high", archived: true })
      ];

      const result = calculateSlaSnapshot(tasks, today);
      expect(result.healthy).toBe(0);
      expect(result.warning).toBe(0);
      expect(result.danger).toBe(0);
    });
  });

  describe("forecastDelivery", () => {
    const today = new Date("2024-01-15");

    it("应计算交付预测", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", estimateHours: 40, actualHours: 10 }),
        normalizeTask({ status: "in_progress", estimateHours: 20, actualHours: 5 }),
        normalizeTask({ status: "done", estimateHours: 30, actualHours: 30 })
      ];

      const result = forecastDelivery(tasks, 40, today);
      expect(result.remainingHours).toBe(45);
      expect(result.weeksNeeded).toBe(1.1);
      expect(result.etaDate).toBeDefined();
    });

    it("应在速度为0时返回null的ETA", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", estimateHours: 40, actualHours: 0 })
      ];

      const result = forecastDelivery(tasks, 0, today);
      expect(result.remainingHours).toBe(40);
      expect(result.weeksNeeded).toBeNull();
      expect(result.etaDate).toBeNull();
    });

    it("应在无剩余工作时返回零工时", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "done", estimateHours: 40, actualHours: 40 })
      ];

      const result = forecastDelivery(tasks, 40, today);
      expect(result.remainingHours).toBe(0);
      expect(result.weeksNeeded).toBe(0);
    });

    it("应确保剩余工时不为负", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", estimateHours: 10, actualHours: 15 })
      ];

      const result = forecastDelivery(tasks, 40, today);
      expect(result.remainingHours).toBe(0);
    });
  });

  describe("reorderByRisk", () => {
    const today = new Date("2024-01-15");

    it("应按风险重新排序任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", priority: "low", status: "todo", dueDate: "2024-02-01" }),
        normalizeTask({ id: "2", priority: "urgent", status: "blocked", dueDate: "2024-01-10" }),
        normalizeTask({ id: "3", priority: "high", status: "todo", dueDate: "2024-01-15" })
      ];

      const result = reorderByRisk(tasks, today);
      expect(result[0].id).toBe("2");
      expect(result[1].id).toBe("3");
      expect(result[2].id).toBe("1");
    });

    it("应在风险相同时按截止日期排序", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", priority: "high", status: "todo", dueDate: "2024-01-20" }),
        normalizeTask({ id: "2", priority: "high", status: "todo", dueDate: "2024-01-15" })
      ];

      const result = reorderByRisk(tasks, today);
      expect(result[0].id).toBe("2");
      expect(result[1].id).toBe("1");
    });

    it("不应修改原数组", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ id: "1", priority: "low", status: "todo" }),
        normalizeTask({ id: "2", priority: "high", status: "todo" })
      ];

      const original = [...tasks];
      reorderByRisk(tasks, today);
      expect(tasks).toEqual(original);
    });
  });
});
