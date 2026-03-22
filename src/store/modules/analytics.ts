import { defineStore } from "pinia";
import type { TaskItem } from "@/types/task";
import { useTaskStore } from "./tasks";
import { buildSnapshot, buildTrend, mergeSnapshots, type AnalyticsSnapshot } from "@/utils/analytics";

export const useAnalyticsStore = defineStore("analytics", {
  state: () => ({
    snapshots: [] as AnalyticsSnapshot[],
    keepDays: 45
  }),
  getters: {
    latestSnapshot(state): AnalyticsSnapshot | null {
      return state.snapshots[state.snapshots.length - 1] ?? null;
    },
    trend(state) {
      return buildTrend(state.snapshots);
    }
  },
  actions: {
    captureSnapshot(tasks?: TaskItem[]): AnalyticsSnapshot {
      const taskStore = useTaskStore();
      const source = tasks ?? taskStore.tasks;
      const snapshot = buildSnapshot(source);
      this.snapshots = mergeSnapshots(this.snapshots, [snapshot], this.keepDays);
      return snapshot;
    },

    importSnapshots(data: AnalyticsSnapshot[]): void {
      this.snapshots = mergeSnapshots(this.snapshots, data, this.keepDays);
    },

    setKeepDays(days: number): void {
      this.keepDays = Math.min(Math.max(days, 7), 120);
      this.snapshots = this.snapshots.slice(-this.keepDays);
    },

    clearSnapshots(): void {
      this.snapshots = [];
    }
  }
});
