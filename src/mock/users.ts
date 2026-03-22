import type { SessionPayload, UserProfile } from "@/types/user";

export const mockProfiles: UserProfile[] = [
  {
    id: "u_001",
    username: "lina",
    displayName: "Lina Chen",
    role: "owner",
    department: "Platform",
    timezone: "Asia/Shanghai"
  },
  {
    id: "u_002",
    username: "alex",
    displayName: "Alex Wang",
    role: "manager",
    department: "Web",
    timezone: "Asia/Shanghai"
  },
  {
    id: "u_003",
    username: "ming",
    displayName: "Ming Zhao",
    role: "member",
    department: "QA",
    timezone: "Asia/Shanghai"
  }
];

export const mockSession: SessionPayload = {
  token: "local-dev-token",
  expiresAt: "2026-04-30T10:00:00Z",
  profile: mockProfiles[0]
};
