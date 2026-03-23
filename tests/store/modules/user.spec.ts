import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { SessionPayload, UserProfile } from "@/types/user";
import type { UserRole } from "@/types/workflow";
import { useUserStore } from "@/store/modules/user";

const SESSION_STORAGE_KEY = "prompt_lab_session";

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "user-1",
    username: "testuser",
    displayName: "Test User",
    role: "member",
    department: "Engineering",
    timezone: "UTC",
    ...overrides
  };
}

function createSession(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    token: "test-token",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    profile: createProfile(),
    ...overrides
  };
}

describe("useUserStore", () => {
  let store: ReturnType<typeof useUserStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useUserStore();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have empty token", () => {
      expect(store.token).toBe("");
    });

    it("should have null profile", () => {
      expect(store.profile).toBeNull();
    });

    it("should have hydrated false", () => {
      expect(store.hydrated).toBe(false);
    });

    it("should have policyAccepted false", () => {
      expect(store.policyAccepted).toBe(false);
    });
  });

  describe("getters", () => {
    describe("isLoggedIn", () => {
      it("should return false when no token", () => {
        store.token = "";
        store.profile = createProfile();

        expect(store.isLoggedIn).toBe(false);
      });

      it("should return false when no profile", () => {
        store.token = "token";
        store.profile = null;

        expect(store.isLoggedIn).toBe(false);
      });

      it("should return true when both token and profile exist", () => {
        store.token = "token";
        store.profile = createProfile();

        expect(store.isLoggedIn).toBe(true);
      });
    });

    describe("isExpired", () => {
      it("should return true when no expiresAt", () => {
        store.expiresAt = "";

        expect(store.isExpired).toBe(true);
      });

      it("should return true when expiresAt is in the past", () => {
        store.expiresAt = new Date(Date.now() - 1000).toISOString();

        expect(store.isExpired).toBe(true);
      });

      it("should return false when expiresAt is in the future", () => {
        store.expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

        expect(store.isExpired).toBe(false);
      });
    });

    describe("role", () => {
      it("should return profile role when profile exists", () => {
        store.profile = createProfile({ role: "manager" });

        expect(store.role).toBe("manager");
      });

      it("should return viewer when no profile", () => {
        store.profile = null;

        expect(store.role).toBe("viewer");
      });
    });

    describe("permissionList", () => {
      it("should return owner permissions for owner role", () => {
        store.profile = createProfile({ role: "owner" });

        expect(store.permissionList).toContain("task:view");
        expect(store.permissionList).toContain("settings:edit");
        expect(store.permissionList).toContain("ops:sync");
      });

      it("should return manager permissions for manager role", () => {
        store.profile = createProfile({ role: "manager" });

        expect(store.permissionList).toContain("task:view");
        expect(store.permissionList).toContain("task:assign");
        expect(store.permissionList).not.toContain("settings:edit");
      });

      it("should return member permissions for member role", () => {
        store.profile = createProfile({ role: "member" });

        expect(store.permissionList).toContain("task:view");
        expect(store.permissionList).toContain("task:edit");
        expect(store.permissionList).not.toContain("task:assign");
      });

      it("should return viewer permissions for viewer role", () => {
        store.profile = createProfile({ role: "viewer" });

        expect(store.permissionList).toContain("task:view");
        expect(store.permissionList).toContain("report:view");
        expect(store.permissionList).not.toContain("task:edit");
      });
    });

    describe("can", () => {
      it("should return true for allowed permission", () => {
        store.profile = createProfile({ role: "owner" });

        expect(store.can("settings:edit")).toBe(true);
      });

      it("should return false for disallowed permission", () => {
        store.profile = createProfile({ role: "member" });

        expect(store.can("settings:edit")).toBe(false);
      });
    });

    describe("displayName", () => {
      it("should return profile displayName", () => {
        store.profile = createProfile({ displayName: "John Doe" });

        expect(store.displayName).toBe("John Doe");
      });

      it("should return Guest when no profile", () => {
        store.profile = null;

        expect(store.displayName).toBe("Guest");
      });
    });
  });

  describe("actions", () => {
    describe("hydrateSession", () => {
      it("should load session from localStorage", () => {
        const session = createSession();
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

        store.hydrateSession();

        expect(store.token).toBe(session.token);
        expect(store.profile?.id).toBe(session.profile.id);
        expect(store.hydrated).toBe(true);
      });

      it("should not overwrite existing session", () => {
        store.token = "existing-token";
        store.hydrated = true;

        store.hydrateSession();

        expect(store.token).toBe("existing-token");
      });

      it("should handle invalid JSON in localStorage", () => {
        localStorage.setItem(SESSION_STORAGE_KEY, "invalid json");

        store.hydrateSession();

        expect(store.token).toBe("");
        expect(store.profile).toBeNull();
        expect(store.hydrated).toBe(true);
      });

      it("should handle missing localStorage item", () => {
        store.hydrateSession();

        expect(store.token).toBe("");
        expect(store.hydrated).toBe(true);
      });
    });

    describe("login", () => {
      it("should set session data", () => {
        const session = createSession();
        store.login(session);

        expect(store.token).toBe(session.token);
        expect(store.expiresAt).toBe(session.expiresAt);
        expect(store.profile).toEqual(session.profile);
      });

      it("should persist to localStorage", () => {
        const session = createSession();
        store.login(session);

        const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!);
        expect(stored.token).toBe(session.token);
      });
    });

    describe("loginByUsername", () => {
      it("should login with valid username", () => {
        const result = store.loginByUsername("lina");

        expect(result).toBe(true);
        expect(store.isLoggedIn).toBe(true);
      });

      it("should be case-insensitive", () => {
        const result = store.loginByUsername("LINA");

        expect(result).toBe(true);
      });

      it("should trim username", () => {
        const result = store.loginByUsername("  lina  ");

        expect(result).toBe(true);
      });

      it("should return false for invalid username", () => {
        const result = store.loginByUsername("nonexistent");

        expect(result).toBe(false);
        expect(store.isLoggedIn).toBe(false);
      });
    });

    describe("loginAsDefault", () => {
      it("should login with default session", () => {
        store.loginAsDefault();

        expect(store.isLoggedIn).toBe(true);
        expect(store.token).toBeDefined();
        expect(store.profile).toBeDefined();
      });
    });

    describe("logout", () => {
      beforeEach(() => {
        store.login(createSession());
      });

      it("should clear session data", () => {
        store.logout();

        expect(store.token).toBe("");
        expect(store.expiresAt).toBe("");
        expect(store.profile).toBeNull();
        expect(store.policyAccepted).toBe(false);
      });

      it("should remove from localStorage", () => {
        store.logout();

        expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      });
    });

    describe("switchRole", () => {
      beforeEach(() => {
        store.profile = createProfile({ role: "member" });
      });

      it("should change role", () => {
        const result = store.switchRole("manager");

        expect(result).toBe(true);
        expect(store.profile?.role).toBe("manager");
      });

      it("should persist to localStorage", () => {
        store.token = "token";
        store.switchRole("owner");

        const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!);
        expect(stored.profile.role).toBe("owner");
      });

      it("should return false when no profile", () => {
        store.profile = null;
        const result = store.switchRole("owner");

        expect(result).toBe(false);
      });
    });

    describe("setPolicyAccepted", () => {
      it("should set policyAccepted", () => {
        store.setPolicyAccepted(true);

        expect(store.policyAccepted).toBe(true);
      });
    });

    describe("refreshSession", () => {
      beforeEach(() => {
        store.token = "existing-token";
        store.expiresAt = new Date(Date.now() - 1000).toISOString();
      });

      it("should update expiresAt", () => {
        const before = store.expiresAt;
        const result = store.refreshSession(30);

        expect(result).toBe(true);
        expect(store.expiresAt).not.toBe(before);
      });

      it("should persist to localStorage", () => {
        store.profile = createProfile();
        store.refreshSession(30);

        const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!);
        expect(stored.expiresAt).toBe(store.expiresAt);
      });

      it("should return false when no token", () => {
        store.token = "";
        const result = store.refreshSession(30);

        expect(result).toBe(false);
      });

      it("should use default 60 minutes", () => {
        const before = Date.now();
        store.refreshSession();

        const expiresAt = new Date(store.expiresAt).getTime();
        const expectedExpiry = before + 60 * 60 * 1000;
        expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
        expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
      });
    });

    describe("persist", () => {
      it("should save to localStorage when profile and token exist", () => {
        store.token = "token";
        store.expiresAt = "2024-12-31";
        store.profile = createProfile();
        store.persist();

        const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY)!);
        expect(stored.token).toBe("token");
        expect(stored.profile.id).toBe("user-1");
      });

      it("should remove from localStorage when no profile", () => {
        localStorage.setItem(SESSION_STORAGE_KEY, "{}");
        store.token = "token";
        store.profile = null;
        store.persist();

        expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      });

      it("should remove from localStorage when no token", () => {
        localStorage.setItem(SESSION_STORAGE_KEY, "{}");
        store.token = "";
        store.profile = createProfile();
        store.persist();

        expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
      });
    });
  });

  describe("role-based access control", () => {
    const roles: UserRole[] = ["owner", "manager", "member", "viewer"];

    roles.forEach((role) => {
      describe(`${role} role`, () => {
        beforeEach(() => {
          store.profile = createProfile({ role });
        });

        it("should have correct permissions", () => {
          const permissions = store.permissionList;

          expect(permissions).toContain("task:view");
          expect(permissions).toContain("report:view");

          if (role === "owner" || role === "manager") {
            expect(permissions).toContain("task:assign");
            expect(permissions).toContain("task:archive");
          }

          if (role === "owner") {
            expect(permissions).toContain("settings:edit");
          }
        });
      });
    });
  });
});
