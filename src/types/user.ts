import type { UserRole } from "./workflow";

export type UserPermission =
  | "task:view"
  | "task:edit"
  | "task:assign"
  | "task:archive"
  | "task:transition"
  | "report:view"
  | "settings:edit"
  | "ops:sync";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  department: string;
  timezone: string;
}

export interface SessionPayload {
  token: string;
  expiresAt: string;
  profile: UserProfile;
}
