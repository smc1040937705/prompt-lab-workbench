import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useUserStore } from "@/store/modules/user";

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  },
  removeItem(key: string): void {
    this.store.delete(key);
  }
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

describe("useUserStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockLocalStorage.store.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:00:00"));
  });

  describe("state initialization", () => {
    it("should initialize with empty state", () => {
      const store = useUserStore();

      expect(store.token).toBe("");
      expect(store.expiresAt).toBe("");
      expect(store.profile).toBeNull();
      expect(store.policyAccepted).toBe(false);
      expect(store.hydrated).toBe(false);
    });
  });

  describe("getters", () => {
    it("should return false for isLoggedIn when no token", () => {
      const store = useUserStore();
      expect(store.isLoggedIn).toBe(false);
    });

    it("should return true for isLoggedIn when token and profile exist", () => {
      const store = useUserStore();
      store.token = "valid-token";
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "Test User",
        role: "member",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.isLoggedIn).toBe(true);
    });

    it("should return true for isExpired when no expiresAt", () => {
      const store = useUserStore();
      expect(store.isExpired).toBe(true);
    });

    it("should return true for isExpired when past expiration", () => {
      const store = useUserStore();
      store.expiresAt = "2026-03-22T10:00:00Z";

      expect(store.isExpired).toBe(true);
    });

    it("should return false for isExpired when not expired", () => {
      const store = useUserStore();
      store.expiresAt = "2026-03-24T10:00:00Z";

      expect(store.isExpired).toBe(false);
    });

    it("should return viewer role as default", () => {
      const store = useUserStore();
      expect(store.role).toBe("viewer");
    });

    it("should return profile role when available", () => {
      const store = useUserStore();
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "Test User",
        role: "owner",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.role).toBe("owner");
    });

    it("should return correct permissions for owner", () => {
      const store = useUserStore();
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "Test User",
        role: "owner",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.permissionList).toContain("task:view");
      expect(store.permissionList).toContain("task:edit");
      expect(store.permissionList).toContain("settings:edit");
      expect(store.permissionList).toContain("ops:sync");
    });

    it("should return correct permissions for viewer", () => {
      const store = useUserStore();
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "Test User",
        role: "viewer",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.permissionList).toEqual(["task:view", "report:view"]);
    });

    it("should check permissions with can getter", () => {
      const store = useUserStore();
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "Test User",
        role: "member",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.can("task:view")).toBe(true);
      expect(store.can("task:edit")).toBe(true);
      expect(store.can("settings:edit")).toBe(false);
    });

    it("should return Guest as default displayName", () => {
      const store = useUserStore();
      expect(store.displayName).toBe("Guest");
    });

    it("should return profile displayName when available", () => {
      const store = useUserStore();
      store.profile = {
        id: "u_001",
        username: "test",
        displayName: "John Doe",
        role: "member",
        department: "Engineering",
        timezone: "UTC"
      };

      expect(store.displayName).toBe("John Doe");
    });
  });

  describe("hydrateSession", () => {
    it("should hydrate from localStorage", () => {
      const session = {
        token: "stored-token",
        expiresAt: "2026-04-23T10:00:00Z",
        profile: {
          id: "u_001",
          username: "test",
          displayName: "Test User",
          role: "member",
          department: "Engineering",
          timezone: "UTC"
        }
      };
      mockLocalStorage.setItem("prompt_lab_session", JSON.stringify(session));

      const store = useUserStore();
      store.hydrateSession();

      expect(store.token).toBe("stored-token");
      expect(store.expiresAt).toBe("2026-04-23T10:00:00Z");
      expect(store.profile?.id).toBe("u_001");
      expect(store.hydrated).toBe(true);
    });

    it("should not hydrate twice", () => {
      const store = useUserStore();
      store.hydrateSession();
      const firstHydrated = store.hydrated;

      mockLocalStorage.setItem("prompt_lab_session", JSON.stringify({ token: "new" }));
      store.hydrateSession();

      expect(store.token).toBe("");
      expect(store.hydrated).toBe(firstHydrated);
    });

    it("should handle invalid JSON in localStorage", () => {
      mockLocalStorage.setItem("prompt_lab_session", "invalid-json");

      const store = useUserStore();
      store.hydrateSession();

      expect(store.token).toBe("");
      expect(store.hydrated).toBe(true);
    });
  });

  describe("login", () => {
    it("should set session data", () => {
      const store = useUserStore();
      const payload = {
        token: "new-token",
        expiresAt: "2026-04-23T10:00:00Z",
        profile: {
          id: "u_002",
          username: "newuser",
          displayName: "New User",
          role: "manager",
          department: "Sales",
          timezone: "EST"
        }
      };

      store.login(payload);

      expect(store.token).toBe("new-token");
      expect(store.expiresAt).toBe("2026-04-23T10:00:00Z");
      expect(store.profile?.id).toBe("u_002");
    });

    it("should persist to localStorage", () => {
      const store = useUserStore();
      const payload = {
        token: "persist-token",
        expiresAt: "2026-04-23T10:00:00Z",
        profile: {
          id: "u_003",
          username: "persist",
          displayName: "Persist User",
          role: "member",
          department: "HR",
          timezone: "PST"
        }
      };

      store.login(payload);

      const stored = mockLocalStorage.getItem("prompt_lab_session");
      expect(stored).toContain("persist-token");
      expect(stored).toContain("u_003");
    });
  });

  describe("loginByUsername", () => {
    it("should login with existing username", () => {
      const store = useUserStore();
      const result = store.loginByUsername("lina");

      expect(result).toBe(true);
      expect(store.isLoggedIn).toBe(true);
      expect(store.profile?.username).toBe("lina");
    });

    it("should reject non-existing username", () => {
      const store = useUserStore();
      const result = store.loginByUsername("nonexistent");

      expect(result).toBe(false);
      expect(store.isLoggedIn).toBe(false);
    });

    it("should be case-insensitive", () => {
      const store = useUserStore();
      const result = store.loginByUsername("LINA");

      expect(result).toBe(true);
      expect(store.profile?.username).toBe("lina");
    });

    it("should trim whitespace", () => {
      const store = useUserStore();
      const result = store.loginByUsername("  lina  ");

      expect(result).toBe(true);
    });
  });

  describe("loginAsDefault", () => {
    it("should login as default user", () => {
      const store = useUserStore();
      store.loginAsDefault();

      expect(store.isLoggedIn).toBe(true);
      expect(store.profile?.role).toBe("owner");
    });
  });

  describe("logout", () => {
    it("should clear session data", () => {
      const store = useUserStore();
      store.loginAsDefault();

      store.logout();

      expect(store.token).toBe("");
      expect(store.expiresAt).toBe("");
      expect(store.profile).toBeNull();
      expect(store.policyAccepted).toBe(false);
    });

    it("should remove from localStorage", () => {
      const store = useUserStore();
      store.loginAsDefault();

      store.logout();

      expect(mockLocalStorage.getItem("prompt_lab_session")).toBeNull();
    });
  });

  describe("switchRole", () => {
    it("should switch role when logged in", () => {
      const store = useUserStore();
      store.loginAsDefault();

      const result = store.switchRole("manager");

      expect(result).toBe(true);
      expect(store.role).toBe("manager");
    });

    it("should fail when not logged in", () => {
      const store = useUserStore();

      const result = store.switchRole("manager");

      expect(result).toBe(false);
    });

    it("should persist after role switch", () => {
      const store = useUserStore();
      store.loginAsDefault();

      store.switchRole("viewer");

      const stored = mockLocalStorage.getItem("prompt_lab_session");
      expect(stored).toContain("viewer");
    });
  });

  describe("setPolicyAccepted", () => {
    it("should set policy accepted", () => {
      const store = useUserStore();

      store.setPolicyAccepted(true);

      expect(store.policyAccepted).toBe(true);
    });
  });

  describe("refreshSession", () => {
    it("should extend expiration when logged in", () => {
      const store = useUserStore();
      store.loginAsDefault();
      const originalExpires = store.expiresAt;

      const result = store.refreshSession(120);

      expect(result).toBe(true);
      expect(store.expiresAt).not.toBe(originalExpires);
    });

    it("should fail when not logged in", () => {
      const store = useUserStore();

      const result = store.refreshSession(60);

      expect(result).toBe(false);
    });

    it("should persist after refresh", () => {
      const store = useUserStore();
      store.loginAsDefault();

      store.refreshSession(60);

      const stored = mockLocalStorage.getItem("prompt_lab_session");
      expect(stored).toContain(store.expiresAt);
    });
  });
});
