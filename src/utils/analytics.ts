import type { TaskItem } from "@/types/task";
import { calculateTaskRisk } from "./workflow";
import { formatDate } from "./date";

export interface AnalyticsSnapshot {
  date: string;
  activeCount: number;
  doneCount: number;
  blockedCount: number;
  averageRisk: number;
  topAssignee: string | null;
}

export function buildSnapshot(tasks: TaskItem[], now: Date = new Date()): AnalyticsSnapshot {
  const active = tasks.filter((task) => !task.archived);
  const done = active.filter((task) => task.status === "done");
  const blocked = active.filter((task) => task.status === "blocked");
  const averageRisk =
    active.length === 0
      ? 0
      : Math.round(
          active.reduce((acc, task) => acc + calculateTaskRisk(task, now).score, 0) / active.length
        );

  const assigneeCounter = active.reduce<Record<string, number>>((acc, task) => {
    acc[task.assignee] = (acc[task.assignee] ?? 0) + 1;
    return acc;
  }, {});

  const topAssignee =
    Object.entries(assigneeCounter).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  return {
    date: formatDate(now),
    activeCount: active.length,
    doneCount: done.length,
    blockedCount: blocked.length,
    averageRisk,
    topAssignee
  };
}

export function buildTrend(
  snapshots: AnalyticsSnapshot[]
): Array<{ date: string; progressRate: number; blockedRate: number }> {
  return snapshots.map((snapshot) => {
    const progressRate =
      snapshot.activeCount === 0 ? 0 : Math.round((snapshot.doneCount / snapshot.activeCount) * 100);
    const blockedRate =
      snapshot.activeCount === 0
        ? 0
        : Math.round((snapshot.blockedCount / snapshot.activeCount) * 100);
    return {
      date: snapshot.date,
      progressRate,
      blockedRate
    };
  });
}

export function mergeSnapshots(
  current: AnalyticsSnapshot[],
  incoming: AnalyticsSnapshot[],
  keepDays = 30
): AnalyticsSnapshot[] {
  const byDate = new Map<string, AnalyticsSnapshot>();
  [...current, ...incoming].forEach((item) => {
    byDate.set(item.date, item);
  });

  return [...byDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-keepDays);
}
