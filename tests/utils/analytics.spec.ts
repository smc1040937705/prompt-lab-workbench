import { describe, it, expect } from "vitest";
import type { TaskItem } from "@/types/task";
import {
  buildSnapshot,
  buildTrend,
  mergeSnapshots,
  type AnalyticsSnapshot
} from "@/utils/analytics";
import { normalizeTask } from "@/utils/task";

describe("分析工具函数", () => {
  describe("buildSnapshot", () => {
    const now = new Date("2024-01-15");

    it("应构建分析快照", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", assignee: "John", priority: "high" }),
        normalizeTask({ status: "in_progress", assignee: "John", priority: "medium" }),
        normalizeTask({ status: "done", assignee: "Jane", priority: "low" }),
        normalizeTask({ status: "blocked", assignee: "John", priority: "high" }),
        normalizeTask({ status: "todo", assignee: "Jane", priority: "medium", archived: true })
      ];

      const result = buildSnapshot(tasks, now);

      expect(result.date).toBe("2024-01-15");
      expect(result.activeCount).toBe(4);
      expect(result.doneCount).toBe(1);
      expect(result.blockedCount).toBe(1);
      expect(result.averageRisk).toBeDefined();
      expect(result.topAssignee).toBe("John");
    });

    it("应在无任务时返回零值快照", () => {
      const tasks: TaskItem[] = [];

      const result = buildSnapshot(tasks, now);

      expect(result.date).toBe("2024-01-15");
      expect(result.activeCount).toBe(0);
      expect(result.doneCount).toBe(0);
      expect(result.blockedCount).toBe(0);
      expect(result.averageRisk).toBe(0);
      expect(result.topAssignee).toBeNull();
    });

    it("应正确计算平均风险", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", priority: "urgent", dueDate: "2024-01-10" }),
        normalizeTask({ status: "todo", priority: "low", dueDate: "2024-02-01" })
      ];

      const result = buildSnapshot(tasks, now);

      expect(result.averageRisk).toBeGreaterThan(0);
      expect(result.averageRisk).toBeLessThanOrEqual(100);
    });

    it("应正确识别最忙负责人", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", assignee: "John" }),
        normalizeTask({ status: "in_progress", assignee: "John" }),
        normalizeTask({ status: "todo", assignee: "Jane" })
      ];

      const result = buildSnapshot(tasks, now);

      expect(result.topAssignee).toBe("John");
    });

    it("应忽略已归档任务", () => {
      const tasks: TaskItem[] = [
        normalizeTask({ status: "todo", assignee: "John" }),
        normalizeTask({ status: "todo", assignee: "Jane", archived: true })
      ];

      const result = buildSnapshot(tasks, now);

      expect(result.activeCount).toBe(1);
    });
  });

  describe("buildTrend", () => {
    it("应构建趋势数据", () => {
      const snapshots: AnalyticsSnapshot[] = [
        {
          date: "2024-01-13",
          activeCount: 10,
          doneCount: 2,
          blockedCount: 1,
          averageRisk: 30,
          topAssignee: "John"
        },
        {
          date: "2024-01-14",
          activeCount: 10,
          doneCount: 4,
          blockedCount: 2,
          averageRisk: 35,
          topAssignee: "John"
        },
        {
          date: "2024-01-15",
          activeCount: 10,
          doneCount: 6,
          blockedCount: 1,
          averageRisk: 28,
          topAssignee: "Jane"
        }
      ];

      const result = buildTrend(snapshots);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2024-01-13");
      expect(result[0].progressRate).toBe(20);
      expect(result[0].blockedRate).toBe(10);
      expect(result[2].progressRate).toBe(60);
      expect(result[2].blockedRate).toBe(10);
    });

    it("应在无活动任务时返回零比率", () => {
      const snapshots: AnalyticsSnapshot[] = [
        {
          date: "2024-01-15",
          activeCount: 0,
          doneCount: 0,
          blockedCount: 0,
          averageRisk: 0,
          topAssignee: null
        }
      ];

      const result = buildTrend(snapshots);

      expect(result[0].progressRate).toBe(0);
      expect(result[0].blockedRate).toBe(0);
    });

    it("应在无快照时返回空数组", () => {
      const result = buildTrend([]);
      expect(result).toEqual([]);
    });
  });

  describe("mergeSnapshots", () => {
    it("应合并快照并按日期去重", () => {
      const current: AnalyticsSnapshot[] = [
        {
          date: "2024-01-13",
          activeCount: 5,
          doneCount: 1,
          blockedCount: 0,
          averageRisk: 20,
          topAssignee: "John"
        },
        {
          date: "2024-01-14",
          activeCount: 6,
          doneCount: 2,
          blockedCount: 1,
          averageRisk: 25,
          topAssignee: "John"
        }
      ];

      const incoming: AnalyticsSnapshot[] = [
        {
          date: "2024-01-14",
          activeCount: 10,
          doneCount: 4,
          blockedCount: 2,
          averageRisk: 35,
          topAssignee: "Jane"
        },
        {
          date: "2024-01-15",
          activeCount: 12,
          doneCount: 5,
          blockedCount: 1,
          averageRisk: 30,
          topAssignee: "Jane"
        }
      ];

      const result = mergeSnapshots(current, incoming, 30);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2024-01-13");
      expect(result[1].date).toBe("2024-01-14");
      expect(result[1].activeCount).toBe(10);
      expect(result[2].date).toBe("2024-01-15");
    });

    it("应按日期排序结果", () => {
      const current: AnalyticsSnapshot[] = [
        {
          date: "2024-01-15",
          activeCount: 10,
          doneCount: 4,
          blockedCount: 1,
          averageRisk: 30,
          topAssignee: "Jane"
        }
      ];

      const incoming: AnalyticsSnapshot[] = [
        {
          date: "2024-01-13",
          activeCount: 5,
          doneCount: 1,
          blockedCount: 0,
          averageRisk: 20,
          topAssignee: "John"
        },
        {
          date: "2024-01-14",
          activeCount: 7,
          doneCount: 2,
          blockedCount: 1,
          averageRisk: 25,
          topAssignee: "John"
        }
      ];

      const result = mergeSnapshots(current, incoming, 30);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2024-01-13");
      expect(result[1].date).toBe("2024-01-14");
      expect(result[2].date).toBe("2024-01-15");
    });

    it("应保留最近N天的快照", () => {
      const current: AnalyticsSnapshot[] = [];
      const incoming: AnalyticsSnapshot[] = [];

      for (let i = 0; i < 50; i++) {
        const date = new Date("2024-01-01");
        date.setDate(date.getDate() + i);
        incoming.push({
          date: date.toISOString().slice(0, 10),
          activeCount: 10,
          doneCount: 4,
          blockedCount: 1,
          averageRisk: 30,
          topAssignee: "Jane"
        });
      }

      const result = mergeSnapshots(current, incoming, 30);

      expect(result).toHaveLength(30);
      expect(result[0].date).toBe("2024-01-21");
      expect(result[29].date).toBe("2024-02-19");
    });

    it("应使用默认保留天数", () => {
      const current: AnalyticsSnapshot[] = [];
      const incoming: AnalyticsSnapshot[] = [];

      for (let i = 0; i < 50; i++) {
        const date = new Date("2024-01-01");
        date.setDate(date.getDate() + i);
        incoming.push({
          date: date.toISOString().slice(0, 10),
          activeCount: 10,
          doneCount: 4,
          blockedCount: 1,
          averageRisk: 30,
          topAssignee: "Jane"
        });
      }

      const result = mergeSnapshots(current, incoming);

      expect(result).toHaveLength(30);
    });

    it("应在两个数组都为空时返回空数组", () => {
      const result = mergeSnapshots([], [], 30);
      expect(result).toEqual([]);
    });
  });
});
