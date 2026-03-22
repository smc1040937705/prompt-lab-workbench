import { defineStore } from "pinia";
import type { TaskFilter, TaskItem, TaskStatus } from "@/types/task";
import type { WorkflowContext, WorkflowDecision, WorkflowLog } from "@/types/workflow";
import { mockTasks } from "@/mock/tasks";
import {
  calculateTaskStats,
  collectTags,
  estimateWorkloadByAssignee,
  filterTasks,
  groupByStatus,
  mergeTaskPatch,
  normalizeTask,
  pickNextActionableTask,
  sortTasks,
  type TaskSortKey,
  validateDependencies
} from "@/utils/task";
import {
  calculateSlaSnapshot,
  createWorkflowLog,
  evaluateTransition,
  forecastDelivery,
  reorderByRisk
} from "@/utils/workflow";
import { createDraftManager } from "@/utils/storage";

const initialFilter: TaskFilter = {
  status: "all",
  priority: "all",
  assignee: "",
  keyword: "",
  includeArchived: false,
  overdueOnly: false,
  sprint: ""
};

const taskDraftManager = createDraftManager<Partial<TaskItem>>({
  namespace: "prompt_lab_task_draft",
  version: "v2",
  ttlMs: 1000 * 60 * 60 * 24 * 3
});

interface RemoteSyncResult {
  ok: boolean;
  error?: string;
}

export const useTaskStore = defineStore("tasks", {
  state: () => ({
    tasks: mockTasks.map((item) => normalizeTask(item)),
    filter: { ...initialFilter },
    sortBy: "priority" as TaskSortKey,
    selectedTaskIds: [] as string[],
    workflowLogs: [] as WorkflowLog[],
    weeklyVelocityHours: 34,
    syncState: "idle" as "idle" | "syncing" | "failed" | "success",
    syncError: ""
  }),
  getters: {
    visibleTasks(state): TaskItem[] {
      const filtered = filterTasks(state.tasks, state.filter);
      return sortTasks(filtered, state.sortBy);
    },
    groupedVisibleTasks(): Record<TaskStatus, TaskItem[]> {
      return groupByStatus(this.visibleTasks);
    },
    stats(state) {
      return calculateTaskStats(state.tasks);
    },
    assigneeList(state): string[] {
      return [...new Set(state.tasks.map((task) => task.assignee))].sort((a, b) =>
        a.localeCompare(b, "en")
      );
    },
    sprintList(state): string[] {
      return [...new Set(state.tasks.map((task) => task.sprint).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b, "en")
      );
    },
    tagList(state): string[] {
      return collectTags(state.tasks);
    },
    nextTask(): TaskItem | undefined {
      return pickNextActionableTask(this.visibleTasks);
    },
    selectedTasks(state): TaskItem[] {
      const idSet = new Set(state.selectedTaskIds);
      return state.tasks.filter((task) => idSet.has(task.id));
    },
    workloadByAssignee(state): Record<string, number> {
      return estimateWorkloadByAssignee(state.tasks);
    },
    topRiskTasks(): TaskItem[] {
      return reorderByRisk(this.visibleTasks).slice(0, 5);
    },
    dependencyIssues(state) {
      return validateDependencies(state.tasks);
    },
    slaSnapshot(state) {
      return calculateSlaSnapshot(state.tasks);
    },
    deliveryForecast(state) {
      return forecastDelivery(state.tasks, state.weeklyVelocityHours);
    }
  },
  actions: {
    setFilter(filter: Partial<TaskFilter>): void {
      this.filter = {
        ...this.filter,
        ...filter
      };
    },

    resetFilter(): void {
      this.filter = { ...initialFilter };
    },

    setSortBy(sortBy: TaskSortKey): void {
      this.sortBy = sortBy;
    },

    setWeeklyVelocity(hours: number): void {
      const safe = Number.isFinite(hours) ? hours : 0;
      this.weeklyVelocityHours = Math.max(0, Math.round(safe));
    },

    addTask(input: Partial<TaskItem>): TaskItem {
      const item = normalizeTask(input);
      this.tasks.unshift(item);
      return item;
    },

    updateTask(id: string, patch: Partial<TaskItem>): TaskItem | undefined {
      const index = this.tasks.findIndex((task) => task.id === id);
      if (index < 0) {
        return undefined;
      }
      this.tasks[index] = mergeTaskPatch(this.tasks[index], patch);
      return this.tasks[index];
    },

    removeTask(id: string): boolean {
      const index = this.tasks.findIndex((task) => task.id === id);
      if (index < 0) {
        return false;
      }
      this.tasks.splice(index, 1);
      this.selectedTaskIds = this.selectedTaskIds.filter((item) => item !== id);
      return true;
    },

    archiveTask(id: string): boolean {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) {
        return false;
      }
      task.archived = true;
      task.updatedAt = new Date().toISOString().slice(0, 10);
      return true;
    },

    setTaskStatus(id: string, status: TaskStatus): boolean {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) {
        return false;
      }
      task.status = status;
      if (status === "done" && task.actualHours === 0) {
        task.actualHours = task.estimateHours;
      }
      task.updatedAt = new Date().toISOString().slice(0, 10);
      return true;
    },

    setTaskReviewer(id: string, reviewer: string): boolean {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) {
        return false;
      }
      task.reviewer = reviewer.trim() || undefined;
      task.updatedAt = new Date().toISOString().slice(0, 10);
      return true;
    },

    setTaskBlockedReason(id: string, reason: string): boolean {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) {
        return false;
      }
      task.blockedReason = reason.trim();
      task.updatedAt = new Date().toISOString().slice(0, 10);
      return true;
    },

    transitionTask(id: string, to: TaskStatus, context: WorkflowContext): WorkflowDecision {
      const task = this.tasks.find((item) => item.id === id);
      if (!task) {
        return {
          allowed: false,
          code: "invalid_transition",
          reason: "Task does not exist."
        };
      }

      const decision = evaluateTransition(task, to, {
        actorRole: context.actorRole,
        reviewer: context.reviewer
      });
      if (!decision.allowed) {
        return decision;
      }

      const previousStatus = task.status;
      task.status = to;
      if (to === "done" && task.actualHours === 0) {
        task.actualHours = task.estimateHours;
      }
      if (context.reviewer) {
        task.reviewer = context.reviewer;
      }
      task.updatedAt = new Date().toISOString().slice(0, 10);

      const log = createWorkflowLog(id, previousStatus, to, context);
      this.workflowLogs.unshift(log);
      if (this.workflowLogs.length > 100) {
        this.workflowLogs.length = 100;
      }
      return decision;
    },

    toggleSelectTask(id: string): void {
      if (this.selectedTaskIds.includes(id)) {
        this.selectedTaskIds = this.selectedTaskIds.filter((item) => item !== id);
        return;
      }
      this.selectedTaskIds.push(id);
    },

    selectTasks(ids: string[]): void {
      this.selectedTaskIds = [...new Set(ids)];
    },

    clearSelection(): void {
      this.selectedTaskIds = [];
    },

    reassignTasks(ids: string[], assignee: string): number {
      let count = 0;
      this.tasks.forEach((task) => {
        if (!ids.includes(task.id)) {
          return;
        }
        task.assignee = assignee;
        task.updatedAt = new Date().toISOString().slice(0, 10);
        count += 1;
      });
      return count;
    },

    bulkArchive(ids: string[] = this.selectedTaskIds): number {
      let count = 0;
      this.tasks.forEach((task) => {
        if (!ids.includes(task.id) || task.archived) {
          return;
        }
        task.archived = true;
        task.updatedAt = new Date().toISOString().slice(0, 10);
        count += 1;
      });
      this.selectedTaskIds = this.selectedTaskIds.filter((id) => !ids.includes(id));
      return count;
    },

    clearDone(includeArchived = false): number {
      const beforeCount = this.tasks.length;
      this.tasks = this.tasks.filter((task) => {
        if (!includeArchived && task.archived) {
          return true;
        }
        return task.status !== "done";
      });
      this.selectedTaskIds = this.selectedTaskIds.filter((id) =>
        this.tasks.some((task) => task.id === id)
      );
      return beforeCount - this.tasks.length;
    },

    importTasks(payload: Partial<TaskItem>[], mode: "merge" | "replace" = "merge"): number {
      const normalized = payload.map((task) => normalizeTask(task));
      if (mode === "replace") {
        this.tasks = normalized;
        this.selectedTaskIds = [];
        return normalized.length;
      }

      let changed = 0;
      normalized.forEach((item) => {
        const currentIndex = this.tasks.findIndex((task) => task.id === item.id);
        if (currentIndex < 0) {
          this.tasks.push(item);
          changed += 1;
          return;
        }
        this.tasks[currentIndex] = mergeTaskPatch(this.tasks[currentIndex], item);
        changed += 1;
      });
      return changed;
    },

    saveTaskDraft(id: string, patch: Partial<TaskItem>, ttlMs?: number): void {
      taskDraftManager.save(id, patch, ttlMs);
    },

    applyTaskDraft(id: string): boolean {
      const draft = taskDraftManager.load(id);
      if (!draft) {
        return false;
      }
      this.updateTask(id, draft);
      return true;
    },

    clearTaskDraft(id: string): void {
      taskDraftManager.remove(id);
    },

    listTaskDraftIds(): string[] {
      return taskDraftManager.listIds();
    },

    async syncTasks(
      syncer?: (tasks: TaskItem[]) => Promise<RemoteSyncResult>
    ): Promise<boolean> {
      this.syncState = "syncing";
      this.syncError = "";
      const exec =
        syncer ??
        (async () => {
          return { ok: true } as RemoteSyncResult;
        });

      try {
        const result = await exec(this.tasks);
        if (!result.ok) {
          this.syncState = "failed";
          this.syncError = result.error ?? "Unknown sync error.";
          return false;
        }
        this.syncState = "success";
        return true;
      } catch (error) {
        this.syncState = "failed";
        this.syncError = error instanceof Error ? error.message : "Sync exception.";
        return false;
      }
    },

    resetState(): void {
      this.tasks = mockTasks.map((item) => normalizeTask(item));
      this.filter = { ...initialFilter };
      this.sortBy = "priority";
      this.selectedTaskIds = [];
      this.workflowLogs = [];
      this.weeklyVelocityHours = 34;
      this.syncState = "idle";
      this.syncError = "";
    }
  }
});
