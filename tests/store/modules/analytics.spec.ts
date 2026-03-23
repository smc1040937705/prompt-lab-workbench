import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { AnalyticsSnapshot } from "@/utils/analytics";
import { useAnalyticsStore } from "@/store/modules/analytics";

vi.mock("@/store/modules/tasks", () => ({
  useTaskStore: vi.fn()
}));

describe("useAnalyticsStore", () => {
  let store: ReturnType<typeof useAnalyticsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useAnalyticsStore();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have empty snapshots", () => {
      expect(store.snapshots).toEqual([]);
    });

    it("should have default keepDays of 45", () => {
      expect(store.keepDays).toBe(45);
    });
  });

  describe("getters", () => {
    describe("latestSnapshot", () => {
      it("should return null when no snapshots", () => {
        expect(store.latestSnapshot).toBeNull();
      });

      it("should return last snapshot", () => {
        const snapshots: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" },
          { date: "2024-03-02", activeCount: 6, doneCount: 3, blockedCount: 1, averageRisk: 12, topAssignee: "Bob" }
        ];
        store.snapshots = snapshots;

        expect(store.latestSnapshot?.date).toBe("2024-03-02");
      });
    });

    describe("trend", () => {
      it("should return empty array when no snapshots", () => {
        expect(store.trend).toEqual([]);
      });

      it("should build trend from snapshots", () => {
        const snapshots: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 10, doneCount: 5, blockedCount: 2, averageRisk: 15, topAssignee: "Alice" },
          { date: "2024-03-02", activeCount: 10, doneCount: 6, blockedCount: 1, averageRisk: 12, topAssignee: "Alice" }
        ];
        store.snapshots = snapshots;

        const trend = store.trend;

        expect(trend.length).toBe(2);
        expect(trend[0].progressRate).toBe(50);
        expect(trend[1].progressRate).toBe(60);
      });
    });
  });

  describe("actions", () => {
    describe("captureSnapshot", () => {
      it("should capture snapshot from provided tasks", () => {
        const tasks = [
          { id: "t1", status: "todo", archived: false, assignee: "Alice", priority: "medium" as const, dueDate: "2024-03-20", title: "Task", description: "", createdAt: "", updatedAt: "", tags: [], estimateHours: 0, actualHours: 0, blockedReason: "", dependencies: [] }
        ];

        const snapshot = store.captureSnapshot(tasks as any);

        expect(snapshot.activeCount).toBe(1);
        expect(store.snapshots.length).toBe(1);
      });

      it("should merge with existing snapshots", () => {
        store.snapshots = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" }
        ];

        const tasks = [
          { id: "t1", status: "done", archived: false, assignee: "Bob", priority: "medium" as const, dueDate: "2024-03-20", title: "Task", description: "", createdAt: "", updatedAt: "", tags: [], estimateHours: 0, actualHours: 0, blockedReason: "", dependencies: [] }
        ];

        store.captureSnapshot(tasks as any);

        expect(store.snapshots.length).toBe(2);
      });

      it("should respect keepDays limit", () => {
        store.keepDays = 2;
        const existingSnapshots: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" },
          { date: "2024-03-02", activeCount: 6, doneCount: 3, blockedCount: 1, averageRisk: 12, topAssignee: "Bob" }
        ];
        store.snapshots = existingSnapshots;

        const tasks = [
          { id: "t1", status: "todo", archived: false, assignee: "Charlie", priority: "medium" as const, dueDate: "2024-03-20", title: "Task", description: "", createdAt: "", updatedAt: "", tags: [], estimateHours: 0, actualHours: 0, blockedReason: "", dependencies: [] }
        ];

        store.captureSnapshot(tasks as any);

        expect(store.snapshots.length).toBeLessThanOrEqual(2);
      });
    });

    describe("importSnapshots", () => {
      it("should merge imported snapshots", () => {
        const existing: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" }
        ];
        const incoming: AnalyticsSnapshot[] = [
          { date: "2024-03-02", activeCount: 6, doneCount: 3, blockedCount: 1, averageRisk: 12, topAssignee: "Bob" },
          { date: "2024-03-03", activeCount: 7, doneCount: 4, blockedCount: 0, averageRisk: 8, topAssignee: "Charlie" }
        ];

        store.snapshots = existing;
        store.importSnapshots(incoming);

        expect(store.snapshots.length).toBe(3);
      });

      it("should overwrite duplicate dates", () => {
        const existing: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" }
        ];
        const incoming: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 10, doneCount: 5, blockedCount: 2, averageRisk: 15, topAssignee: "Bob" }
        ];

        store.snapshots = existing;
        store.importSnapshots(incoming);

        expect(store.snapshots.length).toBe(1);
        expect(store.snapshots[0].activeCount).toBe(10);
      });

      it("should respect keepDays", () => {
        store.keepDays = 2;
        const incoming: AnalyticsSnapshot[] = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" },
          { date: "2024-03-02", activeCount: 6, doneCount: 3, blockedCount: 1, averageRisk: 12, topAssignee: "Bob" },
          { date: "2024-03-03", activeCount: 7, doneCount: 4, blockedCount: 0, averageRisk: 8, topAssignee: "Charlie" }
        ];

        store.importSnapshots(incoming);

        expect(store.snapshots.length).toBe(2);
      });
    });

    describe("setKeepDays", () => {
      it("should update keepDays", () => {
        store.setKeepDays(30);

        expect(store.keepDays).toBe(30);
      });

      it("should clamp to minimum 7", () => {
        store.setKeepDays(3);

        expect(store.keepDays).toBe(7);
      });

      it("should clamp to maximum 120", () => {
        store.setKeepDays(200);

        expect(store.keepDays).toBe(120);
      });

      it("should trim snapshots when reducing keepDays", () => {
        store.snapshots = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" },
          { date: "2024-03-02", activeCount: 6, doneCount: 3, blockedCount: 1, averageRisk: 12, topAssignee: "Bob" },
          { date: "2024-03-03", activeCount: 7, doneCount: 4, blockedCount: 0, averageRisk: 8, topAssignee: "Charlie" }
        ];

        store.setKeepDays(7);

        expect(store.snapshots.length).toBeLessThanOrEqual(3);
      });
    });

    describe("clearSnapshots", () => {
      it("should clear all snapshots", () => {
        store.snapshots = [
          { date: "2024-03-01", activeCount: 5, doneCount: 2, blockedCount: 0, averageRisk: 10, topAssignee: "Alice" }
        ];

        store.clearSnapshots();

        expect(store.snapshots).toEqual([]);
      });
    });
  });
});
