import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAnalyticsStore } from "@/store/modules/analytics";
import { useTaskStore } from "@/store/modules/tasks";
import type { AnalyticsSnapshot } from "@/utils/analytics";

describe("Analytics Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("初始状态", () => {
    it("应初始化时为空快照数组", () => {
      const store = useAnalyticsStore();
      expect(store.snapshots).toEqual([]);
      expect(store.keepDays).toBe(45);
    });
  });

  describe("Getters", () => {
    it("latestSnapshot应返回最新的快照", () => {
      const store = useAnalyticsStore();
      expect(store.latestSnapshot).toBeNull();
      
      const snapshot: AnalyticsSnapshot = {
        date: "2024-01-15",
        activeCount: 10,
        doneCount: 5,
        blockedCount: 1,
        averageRisk: 30,
        topAssignee: "John"
      };
      store.snapshots = [snapshot];
      
      expect(store.latestSnapshot).toEqual(snapshot);
    });

    it("trend应构建趋势数据", () => {
      const store = useAnalyticsStore();
      store.snapshots = [
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
        }
      ];
      
      const trend = store.trend;
      expect(trend).toHaveLength(2);
      expect(trend[0].progressRate).toBe(20);
      expect(trend[0].blockedRate).toBe(10);
      expect(trend[1].progressRate).toBe(40);
      expect(trend[1].blockedRate).toBe(20);
    });
  });

  describe("Actions", () => {
    describe("captureSnapshot", () => {
      it("应从任务状态捕获分析快照", () => {
        const taskStore = useTaskStore();
        const analyticsStore = useAnalyticsStore();
        
        taskStore.addTask({ title: "Task 1", status: "todo" });
        taskStore.addTask({ title: "Task 2", status: "in_progress" });
        taskStore.addTask({ title: "Task 3", status: "done" });
        
        const snapshot = analyticsStore.captureSnapshot();
        
        expect(snapshot.date).toBeDefined();
        expect(snapshot.activeCount).toBeGreaterThan(0);
        expect(snapshot.doneCount).toBeGreaterThan(0);
        expect(analyticsStore.snapshots).toHaveLength(1);
      });

      it("应从自定义任务列表捕获快照", () => {
        const store = useAnalyticsStore();
        
        const customTasks = [
          { id: "1", title: "Custom Task", status: "todo" as const, archived: false, assignee: "John", dueDate: "2024-12-31" }
        ];
        
        const snapshot = store.captureSnapshot(customTasks as any);
        
        expect(snapshot.activeCount).toBe(1);
        expect(snapshot.topAssignee).toBe("John");
      });

      it("无任务时应返回零值快照", () => {
        const store = useAnalyticsStore();
        
        const snapshot = store.captureSnapshot([]);
        
        expect(snapshot.activeCount).toBe(0);
        expect(snapshot.doneCount).toBe(0);
        expect(snapshot.blockedCount).toBe(0);
        expect(snapshot.averageRisk).toBe(0);
        expect(snapshot.topAssignee).toBeNull();
      });
    });

    describe("importSnapshots", () => {
      it("应导入并合并快照", () => {
        const store = useAnalyticsStore();
        
        const existingSnapshots: AnalyticsSnapshot[] = [
          {
            date: "2024-01-13",
            activeCount: 8,
            doneCount: 2,
            blockedCount: 0,
            averageRisk: 25,
            topAssignee: "John"
          }
        ];
        
        const newSnapshots: AnalyticsSnapshot[] = [
          {
            date: "2024-01-14",
            activeCount: 10,
            doneCount: 4,
            blockedCount: 1,
            averageRisk: 30,
            topAssignee: "Jane"
          },
          {
            date: "2024-01-15",
            activeCount: 12,
            doneCount: 5,
            blockedCount: 2,
            averageRisk: 35,
            topAssignee: "Jane"
          }
        ];
        
        store.snapshots = existingSnapshots;
        store.importSnapshots(newSnapshots);
        
        expect(store.snapshots).toHaveLength(3);
      });

      it("应按日期去重快照", () => {
        const store = useAnalyticsStore();
        
        const snapshots: AnalyticsSnapshot[] = [
          {
            date: "2024-01-15",
            activeCount: 10,
            doneCount: 4,
            blockedCount: 1,
            averageRisk: 30,
            topAssignee: "John"
          },
          {
            date: "2024-01-15",
            activeCount: 12,
            doneCount: 5,
            blockedCount: 2,
            averageRisk: 35,
            topAssignee: "Jane"
          }
        ];
        
        store.importSnapshots(snapshots);
        
        expect(store.snapshots).toHaveLength(1);
        expect(store.snapshots[0].activeCount).toBe(12);
      });

      it("应限制保留的天数", () => {
        const store = useAnalyticsStore();
        store.setKeepDays(7); // 最小保留天数是7
        
        const snapshots: AnalyticsSnapshot[] = [];
        for (let i = 0; i < 10; i++) {
          const date = new Date("2024-01-01");
          date.setDate(date.getDate() + i);
          snapshots.push({
            date: date.toISOString().slice(0, 10),
            activeCount: 10,
            doneCount: 5,
            blockedCount: 1,
            averageRisk: 30,
            topAssignee: "John"
          });
        }
        
        store.importSnapshots(snapshots);
        
        expect(store.snapshots.length).toBeLessThanOrEqual(7);
      });
    });

    describe("setKeepDays", () => {
      it("应设置保留天数", () => {
        const store = useAnalyticsStore();
        
        store.setKeepDays(30);
        expect(store.keepDays).toBe(30);
        
        store.setKeepDays(60);
        expect(store.keepDays).toBe(60);
      });

      it("应限制保留天数在有效范围内", () => {
        const store = useAnalyticsStore();
        
        store.setKeepDays(0);
        expect(store.keepDays).toBe(7);
        
        store.setKeepDays(200);
        expect(store.keepDays).toBe(120);
        
        store.setKeepDays(45);
        expect(store.keepDays).toBe(45);
      });

      it("设置保留天数后应裁剪现有快照", () => {
        const store = useAnalyticsStore();
        const snapshots: AnalyticsSnapshot[] = [];
        for (let i = 0; i < 10; i++) {
          const date = new Date("2024-01-01");
          date.setDate(date.getDate() + i);
          snapshots.push({
            date: date.toISOString().slice(0, 10),
            activeCount: 10,
            doneCount: 5,
            blockedCount: 1,
            averageRisk: 30,
            topAssignee: "John"
          });
        }
        store.snapshots = snapshots;
        
        store.setKeepDays(7); // 最小保留天数是7
        
        expect(store.snapshots.length).toBe(7);
      });
    });

    describe("clearSnapshots", () => {
      it("应清除所有快照", () => {
        const store = useAnalyticsStore();
        store.snapshots = [
          {
            date: "2024-01-15",
            activeCount: 10,
            doneCount: 5,
            blockedCount: 1,
            averageRisk: 30,
            topAssignee: "John"
          }
        ];
        
        store.clearSnapshots();
        
        expect(store.snapshots).toEqual([]);
      });
    });
  });

  describe("集成测试", () => {
    it("应正确完成快照的捕获、导入和分析流程", () => {
      const taskStore = useTaskStore();
      const analyticsStore = useAnalyticsStore();
      
      // 使用replace模式替换原有任务
      const testTasks = [
        { title: "Task 1", status: "todo", assignee: "John" },
        { title: "Task 2", status: "in_progress", assignee: "Jane" },
        { title: "Task 3", status: "done", assignee: "John" },
        { title: "Task 4", status: "blocked", assignee: "John" }
      ];
      taskStore.importTasks(testTasks, "replace");
      
      const snapshot1 = analyticsStore.captureSnapshot();
      expect(snapshot1.activeCount).toBe(4);
      expect(snapshot1.doneCount).toBe(1);
      expect(snapshot1.blockedCount).toBe(1);
      expect(snapshot1.topAssignee).toBe("John");
      
      taskStore.addTask({ title: "Task 5", status: "todo", assignee: "Jane" });
      const snapshot2 = analyticsStore.captureSnapshot();
      expect(snapshot2.activeCount).toBe(5);
      
      // 同一天的快照会被mergeSnapshots去重，所以snapshots长度应为1
      expect(analyticsStore.snapshots).toHaveLength(1);
      
      const trend = analyticsStore.trend;
      expect(trend).toHaveLength(1);
      
      analyticsStore.setKeepDays(7);
      expect(analyticsStore.snapshots.length).toBeLessThanOrEqual(7);
      
      analyticsStore.clearSnapshots();
      expect(analyticsStore.snapshots).toEqual([]);
    });
  });
});
