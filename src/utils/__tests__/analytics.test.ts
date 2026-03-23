import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TaskItem } from "@/types/task";
import { buildSnapshot, buildTrend, mergeSnapshots, type AnalyticsSnapshot } from "@/utils/analytics";

describe("buildSnapshot", () => {
  const today = new Date("2026-03-23");

  const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
    id: "1",
    title: "Task",
    priority: "medium",
    status: "todo",
    assignee: "Alice",
    dueDate: "2026-03-25",
    archived: false,
    ...overrides
  } as TaskItem);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  it("should build snapshot with correct counts", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "1", status: "todo" }),
      createTask({ id: "2", status: "done" }),
      createTask({ id: "3", status: "blocked" }),
      createTask({ id: "4", status: "in_progress" })
    ];

    const snapshot = buildSnapshot(tasks, today);

    expect(snapshot.activeCount).toBe(4);
    expect(snapshot.doneCount).toBe(1);
    expect(snapshot.blockedCount).toBe(1);
  });

  it("should exclude archived tasks from counts", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "1", status: "todo", archived: false }),
      createTask({ id: "2", status: "todo", archived: true })
    ];

    const snapshot = buildSnapshot(tasks, today);

    expect(snapshot.activeCount).toBe(1);
  });

  it("should calculate average risk", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "1", priority: "low" }),
      createTask({ id: "2", priority: "high" })
    ];

    const snapshot = buildSnapshot(tasks, today);

    expect(snapshot.averageRisk).toBeGreaterThan(0);
    expect(snapshot.averageRisk).toBeLessThanOrEqual(100);
  });

  it("should return 0 average risk for no active tasks", () => {
    const snapshot = buildSnapshot([], today);
    expect(snapshot.averageRisk).toBe(0);
  });

  it("should identify top assignee", () => {
    const tasks: TaskItem[] = [
      createTask({ id: "1", assignee: "Alice" }),
      createTask({ id: "2", assignee: "Alice" }),
      createTask({ id: "3", assignee: "Bob" })
    ];

    const snapshot = buildSnapshot(tasks, today);

    expect(snapshot.topAssignee).toBe("Alice");
  });

  it("should return null for top assignee when no tasks", () => {
    const snapshot = buildSnapshot([], today);
    expect(snapshot.topAssignee).toBeNull();
  });

  it("should use provided date", () => {
    const customDate = new Date("2026-01-15");
    const snapshot = buildSnapshot([], customDate);

    expect(snapshot.date).toBe("2026-01-15");
  });
});

describe("buildTrend", () => {
  it("should calculate progress rate", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" },
      { date: "2026-03-21", activeCount: 10, doneCount: 7, blockedCount: 1, averageRisk: 25, topAssignee: "Alice" }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].progressRate).toBe(50);
    expect(trend[1].progressRate).toBe(70);
  });

  it("should calculate blocked rate", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 2, averageRisk: 30, topAssignee: "Alice" }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].blockedRate).toBe(20);
  });

  it("should return 0 rates for no active tasks", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 0, doneCount: 0, blockedCount: 0, averageRisk: 0, topAssignee: null }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].progressRate).toBe(0);
    expect(trend[0].blockedRate).toBe(0);
  });

  it("should preserve date in trend", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].date).toBe("2026-03-20");
  });
});

describe("mergeSnapshots", () => {
  it("should merge current and incoming snapshots", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
    ];
    const incoming: AnalyticsSnapshot[] = [
      { date: "2026-03-21", activeCount: 12, doneCount: 6, blockedCount: 1, averageRisk: 28, topAssignee: "Bob" }
    ];

    const merged = mergeSnapshots(current, incoming);

    expect(merged).toHaveLength(2);
  });

  it("should deduplicate by date (incoming overwrites)", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
    ];
    const incoming: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 15, doneCount: 8, blockedCount: 2, averageRisk: 35, topAssignee: "Bob" }
    ];

    const merged = mergeSnapshots(current, incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].activeCount).toBe(15);
    expect(merged[0].topAssignee).toBe("Bob");
  });

  it("should sort by date", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2026-03-25", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
    ];
    const incoming: AnalyticsSnapshot[] = [
      { date: "2026-03-20", activeCount: 8, doneCount: 4, blockedCount: 1, averageRisk: 35, topAssignee: "Bob" }
    ];

    const merged = mergeSnapshots(current, incoming);

    expect(merged[0].date).toBe("2026-03-20");
    expect(merged[1].date).toBe("2026-03-25");
  });

  it("should respect keepDays limit", () => {
    const snapshots: AnalyticsSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-03-${String(10 + i).padStart(2, "0")}`,
      activeCount: i,
      doneCount: 0,
      blockedCount: 0,
      averageRisk: 0,
      topAssignee: null
    }));

    const merged = mergeSnapshots(snapshots, [], 5);

    expect(merged).toHaveLength(5);
    // Keeps the most recent 5: 03-15, 03-16, 03-17, 03-18, 03-19
    expect(merged[0].date).toBe("2026-03-15");
    expect(merged[4].date).toBe("2026-03-19");
  });

  it("should use default keepDays of 30", () => {
    const snapshots: AnalyticsSnapshot[] = Array.from({ length: 35 }, (_, i) => ({
      date: `2026-02-${1 + i}`,
      activeCount: i,
      doneCount: 0,
      blockedCount: 0,
      averageRisk: 0,
      topAssignee: null
    }));

    const merged = mergeSnapshots(snapshots, []);

    expect(merged).toHaveLength(30);
  });
});
