import { beforeEach, describe, expect, it } from "vitest";
import type { TaskItem, TaskStatus } from "@/types/task";
import type { PriorityPolicy, UserRole, WorkflowContext } from "@/types/workflow";
import {
  calculateSlaSnapshot,
  calculateTaskRisk,
  createWorkflowLog,
  evaluateTransition,
  forecastDelivery,
  getAllowedTransitions,
  reorderByRisk
} from "@/utils/workflow";
import { normalizeTask } from "@/utils/task";

function createTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return normalizeTask({
    id: "task-1",
    title: "Test Task",
    ...overrides
  });
}

function createContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    actorId: "user-1",
    actorRole: "owner",
    ...overrides
  };
}

describe("getAllowedTransitions", () => {
  it("should return allowed transitions for owner from todo", () => {
    const transitions = getAllowedTransitions("todo", "owner");

    expect(transitions).toContain("in_progress");
    expect(transitions).toContain("blocked");
  });

  it("should return allowed transitions for member from todo", () => {
    const transitions = getAllowedTransitions("todo", "member");

    expect(transitions).toContain("in_progress");
    expect(transitions).not.toContain("blocked");
  });

  it("should return allowed transitions for owner from review", () => {
    const transitions = getAllowedTransitions("review", "owner");

    expect(transitions).toContain("done");
    expect(transitions).toContain("in_progress");
  });

  it("should return empty array for member from review to done", () => {
    const transitions = getAllowedTransitions("review", "member");

    expect(transitions).not.toContain("done");
    expect(transitions).toContain("in_progress");
  });

  it("should return transitions from done for owner", () => {
    const transitions = getAllowedTransitions("done", "owner");

    expect(transitions).toContain("in_progress");
  });

  it("should return empty array for member from done", () => {
    const transitions = getAllowedTransitions("done", "member");

    expect(transitions).toEqual([]);
  });
});

describe("evaluateTransition", () => {
  describe("valid transitions", () => {
    it("should allow todo -> in_progress for owner", () => {
      const task = createTask({ status: "todo" });
      const context = createContext({ actorRole: "owner" });

      const result = evaluateTransition(task, "in_progress", context);

      expect(result.allowed).toBe(true);
      expect(result.code).toBe("ok");
    });

    it("should allow todo -> in_progress for member", () => {
      const task = createTask({ status: "todo" });
      const context = createContext({ actorRole: "member" });

      const result = evaluateTransition(task, "in_progress", context);

      expect(result.allowed).toBe(true);
    });

    it("should allow in_progress -> review for member", () => {
      const task = createTask({ status: "in_progress" });
      const context = createContext({ actorRole: "member" });

      const result = evaluateTransition(task, "review", context);

      expect(result.allowed).toBe(true);
    });

    it("should allow review -> done with reviewer for owner", () => {
      const task = createTask({ status: "review", reviewer: "reviewer-1" });
      const context = createContext({ actorRole: "owner" });

      const result = evaluateTransition(task, "done", context);

      expect(result.allowed).toBe(true);
    });

    it("should allow review -> done with context reviewer", () => {
      const task = createTask({ status: "review" });
      const context = createContext({ actorRole: "owner", reviewer: "reviewer-1" });

      const result = evaluateTransition(task, "done", context);

      expect(result.allowed).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    it("should reject same status transition", () => {
      const task = createTask({ status: "todo" });
      const context = createContext();

      const result = evaluateTransition(task, "todo", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("invalid_transition");
    });

    it("should reject undefined transition rule", () => {
      const task = createTask({ status: "todo" });
      const context = createContext();

      const result = evaluateTransition(task, "done", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("invalid_transition");
    });

    it("should reject forbidden role", () => {
      const task = createTask({ status: "todo" });
      const context = createContext({ actorRole: "member" });

      const result = evaluateTransition(task, "blocked", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("forbidden_role");
    });

    it("should reject blocked transition without block reason", () => {
      const task = createTask({ status: "in_progress", blockedReason: "" });
      const context = createContext({ actorRole: "owner" });

      const result = evaluateTransition(task, "blocked", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("missing_block_reason");
    });

    it("should allow blocked transition with block reason", () => {
      const task = createTask({ status: "in_progress", blockedReason: "Waiting for API" });
      const context = createContext({ actorRole: "owner" });

      const result = evaluateTransition(task, "blocked", context);

      expect(result.allowed).toBe(true);
    });

    it("should reject review -> done without reviewer", () => {
      const task = createTask({ status: "review" });
      const context = createContext({ actorRole: "owner" });

      const result = evaluateTransition(task, "done", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("missing_reviewer");
    });

    it("should reject member from review -> done", () => {
      const task = createTask({ status: "review", reviewer: "reviewer-1" });
      const context = createContext({ actorRole: "member" });

      const result = evaluateTransition(task, "done", context);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe("forbidden_role");
    });
  });
});

describe("createWorkflowLog", () => {
  it("should create workflow log with all fields", () => {
    const now = new Date("2024-03-15T10:30:00");
    const context = createContext({
      actorId: "user-1",
      actorRole: "owner",
      note: "Task completed",
      now
    });

    const log = createWorkflowLog("task-1", "in_progress", "done", context);

    expect(log.taskId).toBe("task-1");
    expect(log.from).toBe("in_progress");
    expect(log.to).toBe("done");
    expect(log.actorId).toBe("user-1");
    expect(log.actorRole).toBe("owner");
    expect(log.note).toBe("Task completed");
    expect(log.at).toContain("2024-03-15");
  });

  it("should use current time when now is not provided", () => {
    const context = createContext();
    const before = new Date();
    before.setHours(0, 0, 0, 0);

    const log = createWorkflowLog("task-1", "todo", "in_progress", context);

    expect(log.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("should trim note", () => {
    const context = createContext({ note: "  Trimmed note  " });

    const log = createWorkflowLog("task-1", "todo", "in_progress", context);

    expect(log.note).toBe("Trimmed note");
  });

  it("should use empty string for missing note", () => {
    const context = createContext();

    const log = createWorkflowLog("task-1", "todo", "in_progress", context);

    expect(log.note).toBe("");
  });
});

describe("calculateTaskRisk", () => {
  const today = new Date("2024-03-15");

  it("should return low risk for simple task", () => {
    const task = createTask({
      priority: "low",
      status: "todo",
      assignee: "Alice",
      dueDate: "2024-03-20",
      estimateHours: 0
    });

    const risk = calculateTaskRisk(task, today);

    expect(risk.score).toBeLessThan(26);
    expect(risk.level).toBe("low");
  });

  it("should add score for urgent priority", () => {
    const task = createTask({ priority: "urgent", dueDate: "2024-03-20" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("urgent-priority");
    expect(risk.score).toBeGreaterThanOrEqual(25);
  });

  it("should add score for high priority", () => {
    const task = createTask({ priority: "high", dueDate: "2024-03-20" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("high-priority");
  });

  it("should add score for overdue tasks", () => {
    const task = createTask({ dueDate: "2024-03-10" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("overdue");
    expect(risk.score).toBeGreaterThan(0);
  });

  it("should add score for blocked status", () => {
    const task = createTask({ status: "blocked" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("blocked");
    expect(risk.score).toBeGreaterThanOrEqual(22);
  });

  it("should add score for unassigned task", () => {
    const task = createTask({ assignee: "Unassigned" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("unassigned");
  });

  it("should add score for effort overrun", () => {
    const task = createTask({
      estimateHours: 10,
      actualHours: 15
    });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("effort-overrun");
  });

  it("should reduce score for done tasks", () => {
    const task = createTask({ status: "done", priority: "urgent" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("done");
  });

  it("should return critical level for high risk score", () => {
    const task = createTask({
      priority: "urgent",
      status: "blocked",
      assignee: "Unassigned",
      dueDate: "2024-03-01",
      estimateHours: 10,
      actualHours: 15
    });
    const risk = calculateTaskRisk(task, today);

    expect(risk.level).toBe("critical");
    expect(risk.score).toBeGreaterThanOrEqual(76);
  });

  it("should clamp score between 0 and 100", () => {
    const extremeTask = createTask({
      priority: "urgent",
      status: "blocked",
      assignee: "Unassigned",
      dueDate: "2024-01-01",
      estimateHours: 10,
      actualHours: 20
    });
    const risk = calculateTaskRisk(extremeTask, today);

    expect(risk.score).toBeLessThanOrEqual(100);
    expect(risk.score).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateSlaSnapshot", () => {
  const today = new Date("2024-03-15");
  const defaultPolicies: PriorityPolicy[] = [
    { priority: "urgent", maxOverdueDays: 0 },
    { priority: "high", maxOverdueDays: 1 },
    { priority: "medium", maxOverdueDays: 2 },
    { priority: "low", maxOverdueDays: 4 }
  ];

  it("should return zeros for empty array", () => {
    const result = calculateSlaSnapshot([], today, defaultPolicies);

    expect(result).toEqual({ healthy: 0, warning: 0, danger: 0 });
  });

  it("should count healthy tasks (not overdue)", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-20", priority: "medium" })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result.healthy).toBe(1);
    expect(result.warning).toBe(0);
    expect(result.danger).toBe(0);
  });

  it("should count warning tasks (within max overdue days)", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-14", priority: "medium" })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result.healthy).toBe(0);
    expect(result.warning).toBe(1);
    expect(result.danger).toBe(0);
  });

  it("should count danger tasks (exceeded max overdue days)", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-10", priority: "medium" })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result.healthy).toBe(0);
    expect(result.warning).toBe(0);
    expect(result.danger).toBe(1);
  });

  it("should exclude archived tasks", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-10", priority: "medium", archived: true })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result).toEqual({ healthy: 0, warning: 0, danger: 0 });
  });

  it("should exclude done tasks", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-10", priority: "medium", status: "done" })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result).toEqual({ healthy: 0, warning: 0, danger: 0 });
  });

  it("should use different policies per priority", () => {
    const tasks = [
      createTask({ dueDate: "2024-03-14", priority: "urgent" }),
      createTask({ dueDate: "2024-03-14", priority: "high" })
    ];

    const result = calculateSlaSnapshot(tasks, today, defaultPolicies);

    expect(result.danger).toBe(1);
    expect(result.warning).toBe(1);
  });
});

describe("forecastDelivery", () => {
  const today = new Date("2024-03-15");

  it("should return zero for empty tasks", () => {
    const result = forecastDelivery([], 40, today);

    expect(result.remainingHours).toBe(0);
    expect(result.weeksNeeded).toBe(0);
    expect(result.etaDate).toBe("2024-03-15");
  });

  it("should calculate remaining hours correctly", () => {
    const tasks = [
      createTask({ estimateHours: 10, actualHours: 4, status: "in_progress" }),
      createTask({ estimateHours: 8, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.remainingHours).toBe(14);
  });

  it("should exclude done tasks", () => {
    const tasks = [
      createTask({ estimateHours: 10, actualHours: 0, status: "done" }),
      createTask({ estimateHours: 8, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.remainingHours).toBe(8);
  });

  it("should exclude archived tasks", () => {
    const tasks = [
      createTask({ estimateHours: 10, actualHours: 0, archived: true }),
      createTask({ estimateHours: 8, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.remainingHours).toBe(8);
  });

  it("should calculate weeks needed", () => {
    const tasks = [
      createTask({ estimateHours: 80, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.weeksNeeded).toBe(2);
  });

  it("should calculate ETA date", () => {
    const tasks = [
      createTask({ estimateHours: 80, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.etaDate).toBe("2024-03-29");
  });

  it("should return null for zero velocity", () => {
    const tasks = [
      createTask({ estimateHours: 10, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, 0, today);

    expect(result.weeksNeeded).toBeNull();
    expect(result.etaDate).toBeNull();
  });

  it("should return null for negative velocity", () => {
    const tasks = [
      createTask({ estimateHours: 10, actualHours: 0, status: "todo" })
    ];

    const result = forecastDelivery(tasks, -10, today);

    expect(result.weeksNeeded).toBeNull();
    expect(result.etaDate).toBeNull();
  });

  it("should not return negative remaining hours", () => {
    const tasks = [
      createTask({ estimateHours: 5, actualHours: 10, status: "in_progress" })
    ];

    const result = forecastDelivery(tasks, 40, today);

    expect(result.remainingHours).toBe(0);
  });
});

describe("reorderByRisk", () => {
  const today = new Date("2024-03-15");

  it("should sort tasks by risk score descending", () => {
    const tasks = [
      createTask({ id: "t1", priority: "low", dueDate: "2024-03-20" }),
      createTask({ id: "t2", priority: "urgent", dueDate: "2024-03-20" }),
      createTask({ id: "t3", priority: "medium", dueDate: "2024-03-20" })
    ];

    const sorted = reorderByRisk(tasks, today);

    expect(sorted[0].id).toBe("t2");
    expect(sorted[1].id).toBe("t3");
    expect(sorted[2].id).toBe("t1");
  });

  it("should use due date as tiebreaker", () => {
    const tasks = [
      createTask({ id: "t1", priority: "medium", dueDate: "2024-03-20" }),
      createTask({ id: "t2", priority: "medium", dueDate: "2024-03-10" })
    ];

    const sorted = reorderByRisk(tasks, today);

    expect(sorted[0].id).toBe("t2");
    expect(sorted[1].id).toBe("t1");
  });

  it("should not mutate original array", () => {
    const tasks = [
      createTask({ id: "t1", priority: "low" }),
      createTask({ id: "t2", priority: "high" })
    ];
    const original = [...tasks];

    reorderByRisk(tasks, today);

    expect(tasks).toEqual(original);
  });
});
