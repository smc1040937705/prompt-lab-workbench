import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "@/store/modules/user";
import type { UserRole } from "@/types/workflow";

describe("User Store", () => {
  let mockStorage: Map<string, string>;

  beforeEach(() => {
    setActivePinia(createPinia());
    
    mockStorage = new Map<string, string>();
    Storage.prototype.getItem = vi.fn((key: string) => mockStorage.get(key) ?? null);
    Storage.prototype.setItem = vi.fn((key: string, value: string) => mockStorage.set(key, value));
    Storage.prototype.removeItem = vi.fn((key: string) => mockStorage.delete(key));
    
    vi.clearAllMocks();
  });

  describe("初始状态", () => {
    it("应初始化时为未登录状态", () => {
      const store = useUserStore();
      expect(store.token).toBe("");
      expect(store.expiresAt).toBe("");
      expect(store.profile).toBeNull();
      expect(store.policyAccepted).toBe(false);
      expect(store.hydrated).toBe(false);
    });
  });

  describe("Getters", () => {
    it("isLoggedIn应在有token和profile时返回true", () => {
      const store = useUserStore();
      store.token = "test-token";
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
      
      expect(store.isLoggedIn).toBe(true);
    });

    it("isLoggedIn应在缺少token或profile时返回false", () => {
      const store = useUserStore();
      
      expect(store.isLoggedIn).toBe(false);
      
      store.token = "test-token";
      expect(store.isLoggedIn).toBe(false);
      
      store.token = "";
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
      expect(store.isLoggedIn).toBe(false);
    });

    it("isExpired应在过期时返回true", () => {
      const store = useUserStore();
      
      expect(store.isExpired).toBe(true);
      
      store.expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      expect(store.isExpired).toBe(false);
      
      store.expiresAt = new Date(Date.now() - 1000 * 60 * 60).toISOString();
      expect(store.isExpired).toBe(true);
    });

    it("role应返回用户角色或默认viewer", () => {
      const store = useUserStore();
      
      expect(store.role).toBe("viewer");
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "manager", email: "test@example.com" };
      expect(store.role).toBe("manager");
    });

    it("permissionList应返回对应角色的权限", () => {
      const store = useUserStore();
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "owner", email: "test@example.com" };
      expect(store.permissionList).toContain("task:view");
      expect(store.permissionList).toContain("settings:edit");
      expect(store.permissionList).toContain("ops:sync");
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
      expect(store.permissionList).toContain("task:view");
      expect(store.permissionList).not.toContain("settings:edit");
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "viewer", email: "test@example.com" };
      expect(store.permissionList).toEqual(["task:view", "report:view"]);
    });

    it("can应检查用户是否有指定权限", () => {
      const store = useUserStore();
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
      expect(store.can("task:edit")).toBe(true);
      expect(store.can("settings:edit")).toBe(false);
    });

    it("displayName应返回显示名称或默认值", () => {
      const store = useUserStore();
      
      expect(store.displayName).toBe("Guest");
      
      store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
      expect(store.displayName).toBe("Test User");
    });
  });

  describe("Actions", () => {
    describe("hydrateSession", () => {
      it("应从localStorage恢复会话", () => {
        const store = useUserStore();
        const sessionData = {
          token: "stored-token",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          profile: { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" }
        };
        mockStorage.set("prompt_lab_session", JSON.stringify(sessionData));
        
        store.hydrateSession();
        
        expect(store.token).toBe("stored-token");
        expect(store.profile?.displayName).toBe("Test User");
        expect(store.hydrated).toBe(true);
      });

      it("localStorage无数据时应保持未登录状态", () => {
        const store = useUserStore();
        
        store.hydrateSession();
        
        expect(store.token).toBe("");
        expect(store.profile).toBeNull();
        expect(store.hydrated).toBe(true);
      });

      it("数据无效时应静默失败", () => {
        const store = useUserStore();
        mockStorage.set("prompt_lab_session", "invalid json");
        
        store.hydrateSession();
        
        expect(store.token).toBe("");
        expect(store.profile).toBeNull();
        expect(store.hydrated).toBe(true);
      });

      it("已hydrate后不应重复执行", () => {
        const store = useUserStore();
        const sessionData = {
          token: "stored-token",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          profile: { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" }
        };
        mockStorage.set("prompt_lab_session", JSON.stringify(sessionData));
        
        store.hydrateSession();
        expect(store.token).toBe("stored-token");
        
        store.token = "modified-token";
        store.hydrateSession();
        expect(store.token).toBe("modified-token");
      });
    });

    describe("login", () => {
      it("应登录并持久化会话", () => {
        const store = useUserStore();
        const payload = {
          token: "new-token",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          profile: { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" }
        };
        
        store.login(payload);
        
        expect(store.token).toBe("new-token");
        expect(store.profile?.displayName).toBe("Test User");
        expect(localStorage.setItem).toHaveBeenCalled();
      });
    });

    describe("loginByUsername", () => {
      it("应通过用户名登录", () => {
        const store = useUserStore();
        
        const result = store.loginByUsername("lina");
        
        expect(result).toBe(true);
        expect(store.token).toBeDefined();
        expect(store.profile?.username).toBe("lina");
      });

      it("用户名不存在时应返回false", () => {
        const store = useUserStore();
        
        const result = store.loginByUsername("nonexistent-user");
        
        expect(result).toBe(false);
        expect(store.token).toBe("");
      });

      it("应忽略用户名大小写和空格", () => {
        const store = useUserStore();
        
        const result = store.loginByUsername("  LINA  ");
        
        expect(result).toBe(true);
        expect(store.profile?.username).toBe("lina");
      });
    });

    describe("loginAsDefault", () => {
      it("应使用默认账户登录", () => {
        const store = useUserStore();
        
        store.loginAsDefault();
        
        expect(store.token).toBeDefined();
        expect(store.profile).toBeDefined();
        expect(store.isLoggedIn).toBe(true);
      });
    });

    describe("logout", () => {
      it("应登出并清除会话", () => {
        const store = useUserStore();
        store.loginByUsername("lina");
        expect(store.isLoggedIn).toBe(true);
        
        store.logout();
        
        expect(store.token).toBe("");
        expect(store.profile).toBeNull();
        expect(store.policyAccepted).toBe(false);
        expect(localStorage.removeItem).toHaveBeenCalledWith("prompt_lab_session");
      });
    });

    describe("switchRole", () => {
      it("应切换用户角色", () => {
        const store = useUserStore();
        store.loginByUsername("lina");
        const originalRole = store.role;
        
        const result = store.switchRole("viewer");
        
        expect(result).toBe(true);
        expect(store.role).toBe("viewer");
        expect(store.role).not.toBe(originalRole);
      });

      it("未登录时应返回false", () => {
        const store = useUserStore();
        
        const result = store.switchRole("manager");
        
        expect(result).toBe(false);
      });
    });

    describe("setPolicyAccepted", () => {
      it("应设置政策接受状态", () => {
        const store = useUserStore();
        
        store.setPolicyAccepted(true);
        expect(store.policyAccepted).toBe(true);
        
        store.setPolicyAccepted(false);
        expect(store.policyAccepted).toBe(false);
      });
    });

    describe("refreshSession", () => {
      it("应刷新会话过期时间", () => {
        const store = useUserStore();
        store.loginByUsername("lina");
        const originalExpiry = store.expiresAt;
        
        const result = store.refreshSession(30);
        
        expect(result).toBe(true);
        expect(store.expiresAt).not.toBe(originalExpiry);
      });

      it("未登录时应返回false", () => {
        const store = useUserStore();
        
        const result = store.refreshSession();
        
        expect(result).toBe(false);
      });
    });

    describe("persist", () => {
      it("应将会话保存到localStorage", () => {
        const store = useUserStore();
        store.token = "test-token";
        store.expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();
        store.profile = { id: "1", username: "test", displayName: "Test User", role: "member", email: "test@example.com" };
        
        store.persist();
        
        expect(localStorage.setItem).toHaveBeenCalledWith(
          "prompt_lab_session",
          expect.stringContaining("test-token")
        );
      });

      it("数据不完整时应清除localStorage", () => {
        const store = useUserStore();
        store.token = "test-token";
        
        store.persist();
        
        expect(localStorage.removeItem).toHaveBeenCalledWith("prompt_lab_session");
      });
    });
  });

  describe("集成测试", () => {
    it("应完成完整的登录登出流程", () => {
      const store = useUserStore();
      
      expect(store.isLoggedIn).toBe(false);
      
      store.loginByUsername("lina");
      expect(store.isLoggedIn).toBe(true);
      expect(store.hydrated).toBe(false);
      
      store.hydrateSession();
      expect(store.isLoggedIn).toBe(true);
      expect(store.hydrated).toBe(true);
      
      store.switchRole("viewer");
      expect(store.role).toBe("viewer");
      
      store.refreshSession(60);
      expect(store.isExpired).toBe(false);
      
      store.logout();
      expect(store.isLoggedIn).toBe(false);
    });

    it("应从持久化存储中正确恢复会话", () => {
      const store1 = useUserStore();
      store1.loginByUsername("lina");
      
      const store2 = useUserStore();
      store2.hydrateSession();
      
      expect(store2.isLoggedIn).toBe(true);
      expect(store2.profile?.username).toBe("lina");
    });
  });
});
