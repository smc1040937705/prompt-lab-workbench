import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import {
  buildSnapshot,
  buildTrend,
  mergeSnapshots,
  type AnalyticsSnapshot
} from "@/utils/analytics";
import { normalizeTask } from "@/utils/task";

function createTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return normalizeTask({
    id: "task-1",
    title: "Test Task",
    ...overrides
  });
}

describe("buildSnapshot", () => {
  const now = new Date("2024-03-15T10:30:00");

  it("should return zero values for empty tasks", () => {
    const snapshot = buildSnapshot([], now);

    expect(snapshot.date).toBe("2024-03-15");
    expect(snapshot.activeCount).toBe(0);
    expect(snapshot.doneCount).toBe(0);
    expect(snapshot.blockedCount).toBe(0);
    expect(snapshot.averageRisk).toBe(0);
    expect(snapshot.topAssignee).toBeNull();
  });

  it("should count active tasks correctly", () => {
    const tasks = [
      createTask({ id: "t1", status: "todo" }),
      createTask({ id: "t2", status: "in_progress" }),
      createTask({ id: "t3", status: "done" })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.activeCount).toBe(3);
    expect(snapshot.doneCount).toBe(1);
    expect(snapshot.blockedCount).toBe(0);
  });

  it("should exclude archived tasks from active count", () => {
    const tasks = [
      createTask({ id: "t1", status: "todo", archived: true }),
      createTask({ id: "t2", status: "todo" })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.activeCount).toBe(1);
  });

  it("should count blocked tasks", () => {
    const tasks = [
      createTask({ id: "t1", status: "blocked" }),
      createTask({ id: "t2", status: "blocked" }),
      createTask({ id: "t3", status: "todo" })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.blockedCount).toBe(2);
  });

  it("should calculate average risk score", () => {
    const tasks = [
      createTask({ id: "t1", priority: "low" }),
      createTask({ id: "t2", priority: "high" })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.averageRisk).toBeGreaterThan(0);
    expect(typeof snapshot.averageRisk).toBe("number");
  });

  it("should identify top assignee by task count", () => {
    const tasks = [
      createTask({ id: "t1", assignee: "Alice" }),
      createTask({ id: "t2", assignee: "Alice" }),
      createTask({ id: "t3", assignee: "Bob" })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.topAssignee).toBe("Alice");
  });

  it("should return null topAssignee when no active tasks", () => {
    const tasks = [
      createTask({ id: "t1", status: "done", archived: true })
    ];

    const snapshot = buildSnapshot(tasks, now);

    expect(snapshot.topAssignee).toBeNull();
  });

  it("should use current date when now is not provided", () => {
    const snapshot = buildSnapshot([]);

    expect(snapshot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("buildTrend", () => {
  it("should return empty array for empty snapshots", () => {
    const trend = buildTrend([]);

    expect(trend).toEqual([]);
  });

  it("should calculate progress and blocked rates", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 10, doneCount: 5, blockedCount: 2, averageRisk: 20, topAssignee: "Alice" },
      { date: "2024-03-02", activeCount: 10, doneCount: 6, blockedCount: 1, averageRisk: 18, topAssignee: "Alice" }
    ];

    const trend = buildTrend(snapshots);

    expect(trend.length).toBe(2);
    expect(trend[0].date).toBe("2024-03-01");
    expect(trend[0].progressRate).toBe(50);
    expect(trend[0].blockedRate).toBe(20);
    expect(trend[1].progressRate).toBe(60);
    expect(trend[1].blockedRate).toBe(10);
  });

  it("should handle zero active count", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 0, doneCount: 0, blockedCount: 0, averageRisk: 0, topAssignee: null }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].progressRate).toBe(0);
    expect(trend[0].blockedRate).toBe(0);
  });

  it("should round rates to integers", () => {
    const snapshots: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 3, doneCount: 1, blockedCount: 1, averageRisk: 10, topAssignee: null }
    ];

    const trend = buildTrend(snapshots);

    expect(trend[0].progressRate).toBe(33);
    expect(trend[0].blockedRate).toBe(33);
  });
});

describe("mergeSnapshots", () => {
  it("should merge and sort by date", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2024-03-02", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 15, topAssignee: "Alice" }
    ];
    const incoming: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 4, doneCount: 1, blockedCount: 0, averageRisk: 10, topAssignee: "Bob" },
      { date: "2024-03-03", activeCount: 6, doneCount: 3, blockedCount: 0, averageRisk: 12, topAssignee: "Alice" }
    ];

    const merged = mergeSnapshots(current, incoming);

    expect(merged.length).toBe(3);
    expect(merged[0].date).toBe("2024-03-01");
    expect(merged[1].date).toBe("2024-03-02");
    expect(merged[2].date).toBe("2024-03-03");
  });

  it("should overwrite duplicate dates with incoming", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 15, topAssignee: "Alice" }
    ];
    const incoming: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 20, topAssignee: "Bob" }
    ];

    const merged = mergeSnapshots(current, incoming);

    expect(merged.length).toBe(1);
    expect(merged[0].activeCount).toBe(10);
    expect(merged[0].topAssignee).toBe("Bob");
  });

  it("should limit to keepDays", () => {
    const current: AnalyticsSnapshot[] = [];
    const incoming: AnalyticsSnapshot[] = Array.from({ length: 50 }, (_, i) => ({
      date: `2024-03-${String(i + 1).padStart(2, "0")}`,
      activeCount: i + 1,
      doneCount: 0,
      blockedCount: 0,
      averageRisk: 0,
      topAssignee: null
    }));

    const merged = mergeSnapshots(current, incoming, 30);

    expect(merged.length).toBe(30);
    expect(merged[0].date).toBe("2024-03-21");
    expect(merged[29].date).toBe("2024-03-50");
  });

  it("should use default keepDays of 30", () => {
    const snapshots: AnalyticsSnapshot[] = Array.from({ length: 50 }, (_, i) => ({
      date: `2024-03-${String(i + 1).padStart(2, "0")}`,
      activeCount: i + 1,
      doneCount: 0,
      blockedCount: 0,
      averageRisk: 0,
      topAssignee: null
    }));

    const merged = mergeSnapshots([], snapshots);

    expect(merged.length).toBe(30);
  });

  it("should handle empty arrays", () => {
    const merged = mergeSnapshots([], []);

    expect(merged).toEqual([]);
  });

  it("should preserve current when incoming is empty", () => {
    const current: AnalyticsSnapshot[] = [
      { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 15, topAssignee: "Alice" }
    ];

    const merged = mergeSnapshots(current, []);

    expect(merged).toEqual(current);
  });
});
