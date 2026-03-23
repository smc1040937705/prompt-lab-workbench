import type { TaskItem, TaskStatus } from "@/types/task";
import type {
  PriorityPolicy,
  RiskBreakdown,
  SlaSnapshot,
  UserRole,
  WorkflowContext,
  WorkflowDecision,
  WorkflowLog,
  WorkflowTransition
} from "@/types/workflow";
import { diffInDays, formatDate } from "./date";
import { clamp } from "./index";

const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  {
    from: "todo",
    to: "in_progress",
    allowedRoles: ["owner", "manager", "member"]
  },
  {
    from: "todo",
    to: "blocked",
    allowedRoles: ["owner", "manager"],
    requiresBlockReason: true
  },
  {
    from: "in_progress",
    to: "blocked",
    allowedRoles: ["owner", "manager", "member"],
    requiresBlockReason: true
  },
  {
    from: "in_progress",
    to: "review",
    allowedRoles: ["owner", "manager", "member"],
    requiresReviewer: false
  },
  {
    from: "review",
    to: "done",
    allowedRoles: ["owner", "manager"],
    requiresReviewer: true
  },
  {
    from: "review",
    to: "in_progress",
    allowedRoles: ["owner", "manager", "member"]
  },
  {
    from: "blocked",
    to: "in_progress",
    allowedRoles: ["owner", "manager", "member"]
  },
  {
    from: "blocked",
    to: "todo",
    allowedRoles: ["owner", "manager"]
  },
  {
    from: "done",
    to: "in_progress",
    allowedRoles: ["owner", "manager"]
  }
];

const DEFAULT_PRIORITY_POLICIES: PriorityPolicy[] = [
  { priority: "urgent", maxOverdueDays: 0 },
  { priority: "high", maxOverdueDays: 1 },
  { priority: "medium", maxOverdueDays: 2 },
  { priority: "low", maxOverdueDays: 4 }
];

function findTransition(from: TaskStatus, to: TaskStatus): WorkflowTransition | undefined {
  return WORKFLOW_TRANSITIONS.find((item) => item.from === from && item.to === to);
}

export function getAllowedTransitions(
  from: TaskStatus,
  role: UserRole
): TaskStatus[] {
  return WORKFLOW_TRANSITIONS.filter(
    (item) => item.from === from && item.allowedRoles.includes(role)
  ).map((item) => item.to);
}

export function evaluateTransition(
  task: Pick<TaskItem, "status" | "reviewer" | "blockedReason">,
  to: TaskStatus,
  context: Pick<WorkflowContext, "actorRole" | "reviewer">
): WorkflowDecision {
  if (task.status === to) {
    return {
      allowed: false,
      code: "invalid_transition",
      reason: "Target status matches current status."
    };
  }

  const transition = findTransition(task.status, to);
  if (!transition) {
    return {
      allowed: false,
      code: "invalid_transition",
      reason: `No transition rule from ${task.status} to ${to}.`
    };
  }

  if (!transition.allowedRoles.includes(context.actorRole)) {
    return {
      allowed: false,
      code: "forbidden_role",
      reason: `Role ${context.actorRole} cannot perform this transition.`
    };
  }

  if (transition.requiresBlockReason && !task.blockedReason?.trim()) {
    return {
      allowed: false,
      code: "missing_block_reason",
      reason: "Blocked status requires a non-empty block reason."
    };
  }

  if (transition.requiresReviewer && !(context.reviewer || task.reviewer)) {
    return {
      allowed: false,
      code: "missing_reviewer",
      reason: "Done status requires a reviewer."
    };
  }

  return {
    allowed: true,
    code: "ok"
  };
}

export function createWorkflowLog(
  taskId: string,
  from: TaskStatus,
  to: TaskStatus,
  context: WorkflowContext
): WorkflowLog {
  const now = context.now ?? new Date();
  return {
    taskId,
    from,
    to,
    actorId: context.actorId,
    actorRole: context.actorRole,
    note: context.note?.trim() || "",
    at: `${formatDate(now)}T${now.toTimeString().slice(0, 8)}`
  };
}

export function calculateTaskRisk(task: TaskItem, today: Date = new Date()): RiskBreakdown {
  let score = 0;
  const factors: string[] = [];

  if (task.priority === "urgent") {
    score += 25;
    factors.push("urgent-priority");
  } else if (task.priority === "high") {
    score += 18;
    factors.push("high-priority");
  } else if (task.priority === "medium") {
    score += 10;
  } else {
    score += 4;
  }

  const overdueDays = Math.max(diffInDays(task.dueDate, today), 0);
  if (overdueDays > 0) {
    score += clamp(overdueDays * 8, 8, 42);
    factors.push("overdue");
  }

  if (task.status === "blocked") {
    score += 22;
    factors.push("blocked");
  }

  if (!task.assignee || task.assignee === "Unassigned") {
    score += 12;
    factors.push("unassigned");
  }

  if (task.estimateHours > 0) {
    const overrun = task.actualHours / task.estimateHours;
    if (overrun > 1.3) {
      score += 15;
      factors.push("effort-overrun");
    } else if (overrun > 0.9) {
      score += 6;
    }
  }

  if (task.status === "done") {
    score -= 20;
    factors.push("done");
  }

  const normalized = clamp(Math.round(score), 0, 100);
  const level =
    normalized >= 76
      ? "critical"
      : normalized >= 51
        ? "high"
        : normalized >= 26
          ? "medium"
          : "low";

  return {
    score: normalized,
    level,
    factors
  };
}

function policyMap(policies: PriorityPolicy[]): Record<TaskItem["priority"], PriorityPolicy> {
  return policies.reduce<Record<TaskItem["priority"], PriorityPolicy>>(
    (acc, item) => {
      acc[item.priority] = item;
      return acc;
    },
    {
      low: DEFAULT_PRIORITY_POLICIES[3],
      medium: DEFAULT_PRIORITY_POLICIES[2],
      high: DEFAULT_PRIORITY_POLICIES[1],
      urgent: DEFAULT_PRIORITY_POLICIES[0]
    }
  );
}

export function calculateSlaSnapshot(
  tasks: TaskItem[],
  today: Date = new Date(),
  policies: PriorityPolicy[] = DEFAULT_PRIORITY_POLICIES
): SlaSnapshot {
  const mapping = policyMap(policies);
  return tasks.reduce<SlaSnapshot>(
    (acc, task) => {
      if (task.archived || task.status === "done") {
        return acc;
      }

      const overdueDays = Math.max(diffInDays(task.dueDate, today), 0);
      const policy = mapping[task.priority];

      if (overdueDays === 0) {
        acc.healthy += 1;
      } else if (overdueDays <= policy.maxOverdueDays) {
        acc.warning += 1;
      } else {
        acc.danger += 1;
      }
      return acc;
    },
    {
      healthy: 0,
      warning: 0,
      danger: 0
    }
  );
}

export interface DeliveryForecast {
  remainingHours: number;
  weeksNeeded: number | null;
  etaDate: string | null;
}

export function forecastDelivery(
  tasks: TaskItem[],
  velocityPerWeek: number,
  today: Date = new Date()
): DeliveryForecast {
  const remainingHours = Math.max(
    0,
    tasks
      .filter((item) => !item.archived && item.status !== "done")
      .reduce((acc, item) => acc + Math.max(item.estimateHours - item.actualHours, 0), 0)
  );

  if (velocityPerWeek <= 0) {
    return {
      remainingHours,
      weeksNeeded: null,
      etaDate: null
    };
  }

  const weeksNeeded = Number((remainingHours / velocityPerWeek).toFixed(1));
  const eta = new Date(today.getTime());
  eta.setDate(eta.getDate() + Math.ceil(weeksNeeded * 7));

  return {
    remainingHours,
    weeksNeeded,
    etaDate: formatDate(eta)
  };
}

export function reorderByRisk(tasks: TaskItem[], today: Date = new Date()): TaskItem[] {
  return [...tasks].sort((left, right) => {
    const leftRisk = calculateTaskRisk(left, today).score;
    const rightRisk = calculateTaskRisk(right, today).score;
    if (leftRisk !== rightRisk) {
      return rightRisk - leftRisk;
    }
    return diffInDays(right.dueDate, left.dueDate);
  });
}
