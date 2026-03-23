import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAnalyticsStore } from "@/store/modules/analytics";
import { useTaskStore } from "@/store/modules/tasks";
import type { AnalyticsSnapshot } from "@/utils/analytics";

describe("useAnalyticsStore", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:00:00"));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("state initialization", () => {
    it("should initialize with empty snapshots", () => {
      const store = useAnalyticsStore();
      expect(store.snapshots).toEqual([]);
    });

    it("should have default keepDays", () => {
      const store = useAnalyticsStore();
      expect(store.keepDays).toBe(45);
    });
  });

  describe("getters - latestSnapshot", () => {
    it("should return null when no snapshots", () => {
      const store = useAnalyticsStore();
      expect(store.latestSnapshot).toBeNull();
    });

    it("should return last snapshot", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" },
        { date: "2026-03-21", activeCount: 12, doneCount: 6, blockedCount: 1, averageRisk: 28, topAssignee: "Bob" }
      ];

      expect(store.latestSnapshot?.date).toBe("2026-03-21");
      expect(store.latestSnapshot?.topAssignee).toBe("Bob");
    });
  });

  describe("getters - trend", () => {
    it("should return empty trend for no snapshots", () => {
      const store = useAnalyticsStore();
      expect(store.trend).toEqual([]);
    });

    it("should calculate trend from snapshots", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" },
        { date: "2026-03-21", activeCount: 10, doneCount: 7, blockedCount: 1, averageRisk: 25, topAssignee: "Alice" }
      ];

      const trend = store.trend;

      expect(trend).toHaveLength(2);
      expect(trend[0].progressRate).toBe(50);
      expect(trend[1].progressRate).toBe(70);
    });
  });

  describe("captureSnapshot", () => {
    it("should capture snapshot from task store", () => {
      const analyticsStore = useAnalyticsStore();
      const taskStore = useTaskStore();

      const snapshot = analyticsStore.captureSnapshot();

      expect(snapshot.date).toBe("2026-03-23");
      expect(snapshot.activeCount).toBeGreaterThanOrEqual(0);
    });

    it("should use provided tasks", () => {
      const store = useAnalyticsStore();

      const snapshot = store.captureSnapshot([
        { id: "1", status: "todo", priority: "high", archived: false, dueDate: "2026-03-25" } as any
      ]);

      expect(snapshot.activeCount).toBe(1);
    });

    it("should add snapshot to store", () => {
      const store = useAnalyticsStore();

      store.captureSnapshot();

      expect(store.snapshots).toHaveLength(1);
    });

    it("should merge with existing snapshots", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
      ];

      store.captureSnapshot();

      expect(store.snapshots).toHaveLength(2);
    });

    it("should respect keepDays limit", () => {
      const store = useAnalyticsStore();
      store.keepDays = 5;
      store.snapshots = Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-${15 + i}`,
        activeCount: i,
        doneCount: 0,
        blockedCount: 0,
        averageRisk: 0,
        topAssignee: null
      }));

      store.captureSnapshot();

      expect(store.snapshots.length).toBeLessThanOrEqual(5);
    });
  });

  describe("importSnapshots", () => {
    it("should import external snapshots", () => {
      const store = useAnalyticsStore();
      const incoming: AnalyticsSnapshot[] = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" },
        { date: "2026-03-21", activeCount: 12, doneCount: 6, blockedCount: 1, averageRisk: 28, topAssignee: "Bob" }
      ];

      store.importSnapshots(incoming);

      expect(store.snapshots).toHaveLength(2);
    });

    it("should merge with existing snapshots", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-19", activeCount: 8, doneCount: 4, blockedCount: 1, averageRisk: 35, topAssignee: "Charlie" }
      ];
      const incoming: AnalyticsSnapshot[] = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
      ];

      store.importSnapshots(incoming);

      expect(store.snapshots).toHaveLength(2);
    });

    it("should deduplicate by date", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
      ];
      const incoming: AnalyticsSnapshot[] = [
        { date: "2026-03-20", activeCount: 15, doneCount: 8, blockedCount: 2, averageRisk: 35, topAssignee: "Bob" }
      ];

      store.importSnapshots(incoming);

      expect(store.snapshots).toHaveLength(1);
      expect(store.snapshots[0].activeCount).toBe(15);
    });
  });

  describe("setKeepDays", () => {
    it("should update keepDays", () => {
      const store = useAnalyticsStore();
      store.setKeepDays(60);

      expect(store.keepDays).toBe(60);
    });

    it("should enforce minimum of 7 days", () => {
      const store = useAnalyticsStore();
      store.setKeepDays(5);

      expect(store.keepDays).toBe(7);
    });

    it("should enforce maximum of 120 days", () => {
      const store = useAnalyticsStore();
      store.setKeepDays(150);

      expect(store.keepDays).toBe(120);
    });


  });

  describe("clearSnapshots", () => {
    it("should remove all snapshots", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
        { date: "2026-03-20", activeCount: 10, doneCount: 5, blockedCount: 1, averageRisk: 30, topAssignee: "Alice" }
      ];

      store.clearSnapshots();

      expect(store.snapshots).toEqual([]);
    });
  });
});
