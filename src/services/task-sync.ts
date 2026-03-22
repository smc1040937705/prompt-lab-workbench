import type { TaskItem } from "@/types/task";
import { createHttpClient, type HttpResult } from "@/utils/http-client";

export interface PushTasksResponse {
  accepted: number;
  rejected: number;
  syncVersion: string;
}

export interface SyncHealth {
  status: "ok" | "degraded" | "down";
  message: string;
}

export interface TaskSyncServiceOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  getToken?: () => string | null;
}

export function createTaskSyncService(options: TaskSyncServiceOptions) {
  const client = createHttpClient({
    baseUrl: options.baseUrl,
    fetcher: options.fetcher,
    getAuthToken: options.getToken
  });

  async function pushTasks(tasks: TaskItem[]): Promise<HttpResult<PushTasksResponse>> {
    return client.request<PushTasksResponse>({
      method: "POST",
      path: "/sync/tasks",
      body: {
        tasks
      },
      retry: 2,
      retryDelayMs: 180,
      timeoutMs: 7000
    });
  }

  async function healthCheck(): Promise<HttpResult<SyncHealth>> {
    return client.request<SyncHealth>({
      method: "GET",
      path: "/health",
      retry: 1,
      timeoutMs: 2500
    });
  }

  return {
    pushTasks,
    healthCheck
  };
}

export async function localRulesSyncer(tasks: TaskItem[]): Promise<{ ok: boolean; error?: string }> {
  const hasBlockingError = tasks.some(
    (task) => task.status === "blocked" && task.blockedReason.trim().length === 0
  );
  if (hasBlockingError) {
    return {
      ok: false,
      error: "Blocked tasks must include a non-empty blockedReason before syncing."
    };
  }

  const hasInvalidDependency = tasks.some((task) => task.dependencies.includes(task.id));
  if (hasInvalidDependency) {
    return {
      ok: false,
      error: "Task dependency graph contains self-reference."
    };
  }

  return {
    ok: true
  };
}
