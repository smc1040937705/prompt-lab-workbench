import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskItem, TaskStatus } from "@/types/task";
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

describe("getAllowedTransitions", () => {
  it("should return allowed transitions for owner role", () => {
    const transitions = getAllowedTransitions("todo", "owner");
    expect(transitions).toContain("in_progress");
    expect(transitions).toContain("blocked");
  });

  it("should return allowed transitions for member role", () => {
    const transitions = getAllowedTransitions("todo", "member");
    expect(transitions).toContain("in_progress");
    expect(transitions).not.toContain("blocked");
  });

  it("should return empty array for invalid status", () => {
    const transitions = getAllowedTransitions("invalid" as TaskStatus, "owner");
    expect(transitions).toEqual([]);
  });

  it("should handle viewer role with limited permissions", () => {
    const transitions = getAllowedTransitions("todo", "viewer");
    expect(transitions).toEqual([]);
  });
});

describe("evaluateTransition", () => {
  const createTask = (overrides: Partial<TaskItem> = {}): Pick<TaskItem, "status" | "reviewer" | "blockedReason"> => ({
    status: "todo",
    reviewer: undefined,
    blockedReason: "",
    ...overrides
  });

  const createContext = (overrides: Partial<WorkflowContext> = {}): Pick<WorkflowContext, "actorRole" | "reviewer"> => ({
    actorRole: "owner",
    reviewer: undefined,
    ...overrides
  });

  it("should allow valid transition", () => {
    const task = createTask({ status: "todo" });
    const context = createContext({ actorRole: "member" });

    const result = evaluateTransition(task, "in_progress", context);

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ok");
  });

  it("should reject same status transition", () => {
    const task = createTask({ status: "todo" });
    const context = createContext();

    const result = evaluateTransition(task, "todo", context);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("invalid_transition");
  });

  it("should reject invalid transition", () => {
    const task = createTask({ status: "todo" });
    const context = createContext();

    const result = evaluateTransition(task, "done", context);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("invalid_transition");
  });

  it("should reject transition for forbidden role", () => {
    const task = createTask({ status: "todo" });
    const context = createContext({ actorRole: "member" });

    const result = evaluateTransition(task, "blocked", context);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("forbidden_role");
  });

  it("should require block reason for blocked status", () => {
    const task = createTask({ status: "todo" });
    const context = createContext({ actorRole: "owner" });

    const result = evaluateTransition(task, "blocked", context);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("missing_block_reason");
  });

  it("should allow blocked transition with reason", () => {
    const task = createTask({ status: "todo", blockedReason: "Waiting for API" });
    const context = createContext({ actorRole: "owner" });

    const result = evaluateTransition(task, "blocked", context);

    expect(result.allowed).toBe(true);
  });

  it("should require reviewer for done from review", () => {
    const task = createTask({ status: "review" });
    const context = createContext({ actorRole: "owner" });

    const result = evaluateTransition(task, "done", context);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("missing_reviewer");
  });

  it("should allow done with task reviewer", () => {
    const task = createTask({ status: "review", reviewer: "Alice" });
    const context = createContext({ actorRole: "owner" });

    const result = evaluateTransition(task, "done", context);

    expect(result.allowed).toBe(true);
  });

  it("should allow done with context reviewer", () => {
    const task = createTask({ status: "review" });
    const context = createContext({ actorRole: "owner", reviewer: "Alice" });

    const result = evaluateTransition(task, "done", context);

    expect(result.allowed).toBe(true);
  });
});

describe("createWorkflowLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:30:00"));
  });

  it("should create log entry", () => {
    const context: WorkflowContext = {
      actorId: "user_123",
      actorRole: "owner",
      note: "Completed review"
    };

    const log = createWorkflowLog("task_456", "review", "done", context);

    expect(log.taskId).toBe("task_456");
    expect(log.from).toBe("review");
    expect(log.to).toBe("done");
    expect(log.actorId).toBe("user_123");
    expect(log.actorRole).toBe("owner");
    expect(log.note).toBe("Completed review");
    expect(log.at).toMatch(/^2026-03-23T\d{2}:\d{2}:\d{2}$/);
  });

  it("should use provided time", () => {
    const customTime = new Date("2026-01-15T14:20:30");
    const context: WorkflowContext = {
      actorId: "user_123",
      actorRole: "member",
      now: customTime
    };

    const log = createWorkflowLog("task_1", "todo", "in_progress", context);

    expect(log.at).toBe("2026-01-15T14:20:30");
  });

  it("should trim empty note", () => {
    const context: WorkflowContext = {
      actorId: "user_123",
      actorRole: "member",
      note: "   "
    };

    const log = createWorkflowLog("task_1", "todo", "in_progress", context);

    expect(log.note).toBe("");
  });
});

describe("calculateTaskRisk", () => {
  const today = new Date("2026-03-23");

  const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "1",
    title: "Task",
    priority: "medium",
    status: "todo",
    assignee: "Alice",
    dueDate: "2026-03-25",
    estimateHours: 10,
    actualHours: 5,
    blockedReason: "",
    archived: false,
    ...overrides
  } as TaskItem);

  it("should calculate base risk for medium priority", () => {
    const task = createTask({ priority: "medium" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.score).toBeGreaterThan(0);
    expect(risk.level).toBeDefined();
  });

  it("should add risk for urgent priority", () => {
    const task = createTask({ priority: "urgent" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("urgent-priority");
    expect(risk.score).toBeGreaterThan(20);
  });

  it("should add risk for high priority", () => {
    const task = createTask({ priority: "high" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("high-priority");
  });

  it("should add risk for overdue tasks", () => {
    const task = createTask({ dueDate: "2026-03-20" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("overdue");
  });

  it("should add risk for blocked status", () => {
    const task = createTask({ status: "blocked" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("blocked");
  });

  it("should add risk for unassigned tasks", () => {
    const task = createTask({ assignee: "Unassigned" });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("unassigned");
  });

  it("should add risk for effort overrun", () => {
    const task = createTask({ estimateHours: 10, actualHours: 14 });
    const risk = calculateTaskRisk(task, today);

    expect(risk.factors).toContain("effort-overrun");
  });

  it("should reduce risk for done tasks", () => {
    const todoTask = createTask({ status: "todo" });
    const doneTask = createTask({ status: "done" });

    const todoRisk = calculateTaskRisk(todoTask, today);
    const doneRisk = calculateTaskRisk(doneTask, today);

    expect(doneRisk.score).toBeLessThan(todoRisk.score);
    expect(doneRisk.factors).toContain("done");
  });

  it("should clamp score to 0-100 range", () => {
    const highRiskTask = createTask({
      priority: "urgent",
      status: "blocked",
      dueDate: "2026-03-15",
      assignee: "Unassigned",
      estimateHours: 10,
      actualHours: 20
    });

    const risk = calculateTaskRisk(highRiskTask, today);

    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
  });

  it("should assign correct risk levels", () => {
    const low = calculateTaskRisk(createTask({ priority: "low" }), today);
    // medium priority alone gives score 10, which is < 26, so level is "low"
    const mediumOnly = calculateTaskRisk(createTask({ priority: "medium" }), today);
    // high priority (18) + blocked (22) = 40, which is >= 26 and < 51, so level is "medium"
    const high = calculateTaskRisk(createTask({ priority: "high", status: "blocked" }), today);
    const critical = calculateTaskRisk(createTask({
      priority: "urgent",
      status: "blocked",
      dueDate: "2026-03-15"
    }), today);

    expect(low.level).toBe("low");
    expect(mediumOnly.level).toBe("low"); // Score 10 < 26
    expect(high.level).toBe("medium"); // Score 40 >= 26 and < 51
    expect(critical.level).toBe("critical");
  });
});

describe("calculateSlaSnapshot", () => {
  const today = new Date("2026-03-23");

  const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "1",
    priority: "medium",
    status: "todo",
    dueDate: "2026-03-25",
    archived: false,
    ...overrides
  } as TaskItem);

  it("should categorize healthy tasks", () => {
    const tasks = [createTask({ dueDate: "2026-03-25" })];
    const snapshot = calculateSlaSnapshot(tasks, today);

    expect(snapshot.healthy).toBe(1);
    expect(snapshot.warning).toBe(0);
    expect(snapshot.danger).toBe(0);
  });

  it("should categorize warning tasks", () => {
    const tasks = [createTask({ priority: "medium", dueDate: "2026-03-21" })];
    const snapshot = calculateSlaSnapshot(tasks, today);

    expect(snapshot.healthy).toBe(0);
    expect(snapshot.warning).toBe(1);
    expect(snapshot.danger).toBe(0);
  });

  it("should categorize danger tasks", () => {
    const tasks = [createTask({ priority: "high", dueDate: "2026-03-15" })];
    const snapshot = calculateSlaSnapshot(tasks, today);

    expect(snapshot.healthy).toBe(0);
    expect(snapshot.warning).toBe(0);
    expect(snapshot.danger).toBe(1);
  });

  it("should exclude done tasks", () => {
    const tasks = [
      createTask({ status: "done" }),
      createTask({ status: "todo" })
    ];
    const snapshot = calculateSlaSnapshot(tasks, today);

    expect(snapshot.healthy + snapshot.warning + snapshot.danger).toBe(1);
  });

  it("should exclude archived tasks", () => {
    const tasks = [
      createTask({ archived: true }),
      createTask({ archived: false })
    ];
    const snapshot = calculateSlaSnapshot(tasks, today);

    expect(snapshot.healthy + snapshot.warning + snapshot.danger).toBe(1);
  });

  it("should respect priority policies", () => {
    const customPolicies = [
      { priority: "urgent" as const, maxOverdueDays: 0 },
      { priority: "high" as const, maxOverdueDays: 1 },
      { priority: "medium" as const, maxOverdueDays: 3 },
      { priority: "low" as const, maxOverdueDays: 5 }
    ];

    const tasks = [createTask({ priority: "medium", dueDate: "2026-03-20" })];
    const snapshot = calculateSlaSnapshot(tasks, today, customPolicies);

    expect(snapshot.warning).toBe(1);
    expect(snapshot.danger).toBe(0);
  });
});

describe("forecastDelivery", () => {
  const today = new Date("2026-03-23");

  const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "1",
    status: "todo",
    estimateHours: 10,
    actualHours: 3,
    archived: false,
    ...overrides
  } as TaskItem);

  it("should calculate weeks needed", () => {
    const tasks = [createTask({ estimateHours: 40, actualHours: 0 })];
    const forecast = forecastDelivery(tasks, 20, today);

    expect(forecast.remainingHours).toBe(40);
    expect(forecast.weeksNeeded).toBe(2);
  });

  it("should calculate ETA date", () => {
    const tasks = [createTask({ estimateHours: 20, actualHours: 0 })];
    const forecast = forecastDelivery(tasks, 20, today);

    expect(forecast.etaDate).toBe("2026-03-30");
  });

  it("should return null for zero velocity", () => {
    const tasks = [createTask()];
    const forecast = forecastDelivery(tasks, 0, today);

    expect(forecast.weeksNeeded).toBeNull();
    expect(forecast.etaDate).toBeNull();
  });

  it("should exclude done tasks", () => {
    const tasks = [
      createTask({ status: "done", estimateHours: 40, actualHours: 0 }),
      createTask({ status: "todo", estimateHours: 20, actualHours: 0 })
    ];
    const forecast = forecastDelivery(tasks, 20, today);

    expect(forecast.remainingHours).toBe(20);
  });

  it("should exclude archived tasks", () => {
    const tasks = [
      createTask({ archived: true, estimateHours: 40, actualHours: 0 }),
      createTask({ archived: false, estimateHours: 20, actualHours: 0 })
    ];
    const forecast = forecastDelivery(tasks, 20, today);

    expect(forecast.remainingHours).toBe(20);
  });

  it("should handle partial completion", () => {
    const tasks = [createTask({ estimateHours: 20, actualHours: 15 })];
    const forecast = forecastDelivery(tasks, 10, today);

    expect(forecast.remainingHours).toBe(5);
    expect(forecast.weeksNeeded).toBe(0.5);
  });

  it("should round weeks to 1 decimal", () => {
    const tasks = [createTask({ estimateHours: 25, actualHours: 0 })];
    const forecast = forecastDelivery(tasks, 10, today);

    expect(forecast.weeksNeeded).toBe(2.5);
  });
});

describe("reorderByRisk", () => {
  const today = new Date("2026-03-23");

  const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "1",
    priority: "medium",
    status: "todo",
    dueDate: "2026-03-25",
    assignee: "Alice",
    estimateHours: 10,
    actualHours: 5,
    blockedReason: "",
    archived: false,
    ...overrides
  } as TaskItem);

  it("should sort by risk descending", () => {
    const tasks = [
      createTask({ id: "low", priority: "low" }),
      createTask({ id: "urgent", priority: "urgent" }),
      createTask({ id: "high", priority: "high" })
    ];

    const sorted = reorderByRisk(tasks, today);

    expect(sorted[0].id).toBe("urgent");
    expect(sorted[1].id).toBe("high");
    expect(sorted[2].id).toBe("low");
  });

  it("should use dueDate as tiebreaker", () => {
    const tasks = [
      createTask({ id: "later", priority: "high", dueDate: "2026-03-25" }),
      createTask({ id: "sooner", priority: "high", dueDate: "2026-03-20" })
    ];

    const sorted = reorderByRisk(tasks, today);

    expect(sorted[0].id).toBe("sooner");
    expect(sorted[1].id).toBe("later");
  });

  it("should not mutate original array", () => {
    const tasks = [createTask({ id: "1" }), createTask({ id: "2" })];
    const original = [...tasks];

    reorderByRisk(tasks, today);

    expect(tasks).toEqual(original);
  });
});
