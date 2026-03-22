import { defineStore } from "pinia";
import type { SessionPayload, UserPermission, UserProfile } from "@/types/user";
import type { UserRole } from "@/types/workflow";
import { mockProfiles, mockSession } from "@/mock/users";

const SESSION_STORAGE_KEY = "prompt_lab_session";

const ROLE_PERMISSIONS: Record<UserRole, UserPermission[]> = {
  owner: [
    "task:view",
    "task:edit",
    "task:assign",
    "task:archive",
    "task:transition",
    "report:view",
    "settings:edit",
    "ops:sync"
  ],
  manager: [
    "task:view",
    "task:edit",
    "task:assign",
    "task:archive",
    "task:transition",
    "report:view",
    "ops:sync"
  ],
  member: ["task:view", "task:edit", "task:transition", "report:view"],
  viewer: ["task:view", "report:view"]
};

function safeParseSession(raw: string | null): SessionPayload | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SessionPayload;
  } catch {
    return null;
  }
}

export const useUserStore = defineStore("user", {
  state: () => ({
    token: "",
    expiresAt: "",
    profile: null as UserProfile | null,
    policyAccepted: false,
    hydrated: false
  }),
  getters: {
    isLoggedIn(state): boolean {
      return Boolean(state.token && state.profile);
    },
    isExpired(state): boolean {
      if (!state.expiresAt) {
        return true;
      }
      return new Date(state.expiresAt).getTime() <= Date.now();
    },
    role(state): UserRole {
      return state.profile?.role ?? "viewer";
    },
    permissionList(): UserPermission[] {
      return ROLE_PERMISSIONS[this.role];
    },
    can(): (permission: UserPermission) => boolean {
      return (permission: UserPermission) => this.permissionList.includes(permission);
    },
    displayName(state): string {
      return state.profile?.displayName ?? "Guest";
    }
  },
  actions: {
    hydrateSession(): void {
      if (this.hydrated) {
        return;
      }
      const parsed = safeParseSession(localStorage.getItem(SESSION_STORAGE_KEY));
      if (parsed) {
        this.token = parsed.token;
        this.expiresAt = parsed.expiresAt;
        this.profile = parsed.profile;
      }
      this.hydrated = true;
    },

    login(payload: SessionPayload): void {
      this.token = payload.token;
      this.expiresAt = payload.expiresAt;
      this.profile = payload.profile;
      this.persist();
    },

    loginByUsername(username: string): boolean {
      const profile = mockProfiles.find((item) => item.username === username.toLowerCase().trim());
      if (!profile) {
        return false;
      }
      this.login({
        token: `token-${profile.id}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
        profile
      });
      return true;
    },

    loginAsDefault(): void {
      this.login(mockSession);
    },

    logout(): void {
      this.token = "";
      this.expiresAt = "";
      this.profile = null;
      this.policyAccepted = false;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    },

    switchRole(role: UserRole): boolean {
      if (!this.profile) {
        return false;
      }
      this.profile = {
        ...this.profile,
        role
      };
      this.persist();
      return true;
    },

    setPolicyAccepted(value: boolean): void {
      this.policyAccepted = value;
    },

    refreshSession(expiresInMinutes = 60): boolean {
      if (!this.token) {
        return false;
      }
      this.expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
      this.persist();
      return true;
    },

    persist(): void {
      if (!this.profile || !this.token) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      const payload: SessionPayload = {
        token: this.token,
        expiresAt: this.expiresAt,
        profile: this.profile
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    }
  }
});
