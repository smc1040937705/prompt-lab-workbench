import type { TaskPriority, TaskStatus } from "./task";

export type UserRole = "owner" | "manager" | "member" | "viewer";

export interface WorkflowTransition {
  from: TaskStatus;
  to: TaskStatus;
  allowedRoles: UserRole[];
  requiresBlockReason?: boolean;
  requiresReviewer?: boolean;
}

export interface WorkflowContext {
  actorId: string;
  actorRole: UserRole;
  note?: string;
  reviewer?: string;
  now?: Date;
}

export interface WorkflowDecision {
  allowed: boolean;
  code:
    | "ok"
    | "invalid_transition"
    | "forbidden_role"
    | "missing_block_reason"
    | "missing_reviewer";
  reason?: string;
}

export interface WorkflowLog {
  taskId: string;
  from: TaskStatus;
  to: TaskStatus;
  actorId: string;
  actorRole: UserRole;
  note: string;
  at: string;
}

export interface RiskBreakdown {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: string[];
}

export interface SlaSnapshot {
  healthy: number;
  warning: number;
  danger: number;
}

export interface PriorityPolicy {
  priority: TaskPriority;
  maxOverdueDays: number;
}
