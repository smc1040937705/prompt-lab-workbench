export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  estimateHours: number;
  actualHours: number;
  blockedReason: string;
  reviewer?: string;
  dependencies: string[];
  sprint?: string;
  archived: boolean;
}

export interface TaskFilter {
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  assignee?: string;
  keyword?: string;
  includeArchived?: boolean;
  overdueOnly?: boolean;
  sprint?: string;
}

export interface TaskStats {
  total: number;
  done: number;
  overdue: number;
  archived: number;
  progress: number;
  blocked: number;
  review: number;
}
