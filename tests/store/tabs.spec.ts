import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTabsStore, type TabItem } from "@/store/tabs";

describe("useTabsStore", () => {
  let store: ReturnType<typeof useTabsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTabsStore();
  });

  describe("initial state", () => {
    it("should have home tab by default", () => {
      expect(store.tabs.length).toBe(1);
      expect(store.tabs[0].path).toBe("/dashboard");
      expect(store.tabs[0].pinned).toBe(true);
      expect(store.tabs[0].closable).toBe(false);
    });

    it("should have activePath set to dashboard", () => {
      expect(store.activePath).toBe("/dashboard");
    });

    it("should have default cacheLimit of 12", () => {
      expect(store.cacheLimit).toBe(12);
    });
  });

  describe("getters", () => {
    it("should return true for show when tabs exist", () => {
      expect(store.show).toBe(true);
    });

    it("should return list of tab names", () => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      expect(store.nameList).toContain("dashboard");
      expect(store.nameList).toContain("tasks");
    });
  });

  describe("bindRoute", () => {
    it("should bind route and router", () => {
      const route = { path: "/tasks" };
      const router = { push: vi.fn() };

      store.bindRoute(route, router);

      expect(store.$route).toStrictEqual(route);
      expect(store.$router).toStrictEqual(router);
    });
  });

  describe("setTabsItem", () => {
    it("should add new tab", () => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      expect(store.tabs.length).toBe(2);
      expect(store.tabs[1].path).toBe("/tasks");
      expect(store.activePath).toBe("/tasks");
    });

    it("should update existing tab", () => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Updated Tasks" });

      expect(store.tabs.length).toBe(2);
      expect(store.tabs[1].title).toBe("Updated Tasks");
    });

    it("should use name as title when title is not provided", () => {
      store.setTabsItem({ path: "/settings", name: "settings" });

      expect(store.tabs[1].title).toBe("settings");
    });

    it("should set closable to true for non-pinned tabs", () => {
      store.setTabsItem({ path: "/tasks", name: "tasks" });

      expect(store.tabs[1].closable).toBe(true);
    });

    it("should set closable to false for pinned tabs", () => {
      store.setTabsItem({ path: "/tasks", name: "tasks", pinned: true });

      expect(store.tabs[1].closable).toBe(false);
    });

    it("should enforce cache limit", () => {
      store.cacheLimit = 3;

      for (let i = 0; i < 5; i++) {
        store.setTabsItem({ path: `/page-${i}`, name: `page-${i}` });
      }

      expect(store.tabs.length).toBeLessThanOrEqual(3);
    });
  });

  describe("delTabsItem", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
    });

    it("should remove closable tab", () => {
      store.delTabsItem("/tasks");

      expect(store.tabs.find(t => t.path === "/tasks")).toBeUndefined();
    });

    it("should not remove pinned tab", () => {
      store.setTabsItem({ path: "/settings", name: "settings", pinned: true });
      store.delTabsItem("/settings");

      expect(store.tabs.find(t => t.path === "/settings")).toBeDefined();
    });

    it("should not remove non-closable tab", () => {
      store.delTabsItem("/dashboard");

      expect(store.tabs.find(t => t.path === "/dashboard")).toBeDefined();
    });

    it("should do nothing for non-existent path", () => {
      const beforeCount = store.tabs.length;
      store.delTabsItem("/non-existent");

      expect(store.tabs.length).toBe(beforeCount);
    });

    it("should update activePath when removing active tab", () => {
      store.activePath = "/tasks";
      const push = vi.fn();
      store.$router = { push };

      store.delTabsItem("/tasks");

      expect(store.activePath).not.toBe("/tasks");
      expect(push).toHaveBeenCalled();
    });

    it("should not update activePath when removing inactive tab", () => {
      store.activePath = "/reports";

      store.delTabsItem("/tasks");

      expect(store.activePath).toBe("/reports");
    });
  });

  describe("clearTabs", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
    });

    it("should remove all non-pinned tabs", () => {
      store.clearTabs();

      expect(store.tabs.length).toBe(1);
      expect(store.tabs[0].pinned).toBe(true);
    });

    it("should update activePath to first remaining tab", () => {
      store.clearTabs();

      expect(store.activePath).toBe("/dashboard");
    });

    it("should call router.push", () => {
      const push = vi.fn();
      store.$router = { push };

      store.clearTabs();

      expect(push).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("closeTabsOther", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
    });

    it("should keep only pinned and current tab", () => {
      store.closeTabsOther("/tasks");

      expect(store.tabs.length).toBe(2);
      expect(store.tabs.find(t => t.path === "/tasks")).toBeDefined();
      expect(store.tabs.find(t => t.path === "/reports")).toBeUndefined();
    });

    it("should use $route.path when currentPath is not provided", () => {
      store.$route = { path: "/reports" };
      store.closeTabsOther();

      expect(store.tabs.find(t => t.path === "/reports")).toBeDefined();
    });

    it("should use activePath as fallback", () => {
      store.activePath = "/tasks";
      store.closeTabsOther();

      expect(store.tabs.find(t => t.path === "/tasks")).toBeDefined();
    });

    it("should update activePath to target tab", () => {
      store.closeTabsOther("/tasks");

      expect(store.activePath).toBe("/tasks");
    });
  });

  describe("closeLeft", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
    });

    it("should close tabs to the left of target", () => {
      store.closeLeft("/reports");

      expect(store.tabs.find(t => t.path === "/dashboard")).toBeDefined();
      expect(store.tabs.find(t => t.path === "/tasks")).toBeUndefined();
      expect(store.tabs.find(t => t.path === "/reports")).toBeDefined();
    });

    it("should not close pinned tabs", () => {
      store.setTabsItem({ path: "/pinned", name: "pinned", pinned: true });
      store.closeLeft("/settings");

      expect(store.tabs.find(t => t.path === "/pinned")).toBeDefined();
    });

    it("should do nothing when target is first tab", () => {
      const beforeCount = store.tabs.length;
      store.closeLeft("/dashboard");

      expect(store.tabs.length).toBe(beforeCount);
    });

    it("should use $route.path when currentPath is not provided", () => {
      store.$route = { path: "/settings" };
      store.closeLeft();

      expect(store.tabs.find(t => t.path === "/tasks")).toBeUndefined();
    });
  });

  describe("closeRight", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
    });

    it("should close tabs to the right of target", () => {
      store.closeRight("/reports");

      expect(store.tabs.find(t => t.path === "/reports")).toBeDefined();
      expect(store.tabs.find(t => t.path === "/settings")).toBeUndefined();
    });

    it("should not close pinned tabs", () => {
      store.setTabsItem({ path: "/pinned", name: "pinned", pinned: true });
      store.closeRight("/reports");

      expect(store.tabs.find(t => t.path === "/pinned")).toBeDefined();
    });

    it("should do nothing for non-existent path", () => {
      const beforeCount = store.tabs.length;
      store.closeRight("/non-existent");

      expect(store.tabs.length).toBe(beforeCount);
    });
  });

  describe("closeCurrentTag", () => {
    beforeEach(() => {
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
    });

    it("should close current tab and return next path", () => {
      store.activePath = "/tasks";
      const nextPath = store.closeCurrentTag("/tasks");

      expect(store.tabs.find(t => t.path === "/tasks")).toBeUndefined();
      expect(nextPath).toBe("/reports");
    });

    it("should return current path for pinned tab", () => {
      store.setTabsItem({ path: "/pinned", name: "pinned", pinned: true });
      const nextPath = store.closeCurrentTag("/pinned");

      expect(store.tabs.find(t => t.path === "/pinned")).toBeDefined();
      expect(nextPath).toBe("/pinned");
    });

    it("should return current path for non-closable tab", () => {
      const nextPath = store.closeCurrentTag("/dashboard");

      expect(store.tabs.find(t => t.path === "/dashboard")).toBeDefined();
      expect(nextPath).toBe("/dashboard");
    });

    it("should return '/' when closing the only closable tab", () => {
      store.tabs = [];
      store.setTabsItem({ path: "/only", name: "only", closable: true });
      const nextPath = store.closeCurrentTag("/only");

      expect(nextPath).toBe("/");
      expect(store.tabs.length).toBe(0);
    });

    it("should navigate to previous tab when closing last tab in list", () => {
      store.activePath = "/reports";
      const nextPath = store.closeCurrentTag("/reports");

      expect(nextPath).toBe("/tasks");
    });

    it("should use $route.path when path is not provided", () => {
      store.$route = { path: "/tasks" };
      const nextPath = store.closeCurrentTag();

      expect(store.tabs.find(t => t.path === "/tasks")).toBeUndefined();
    });

    it("should call router.push with next path", () => {
      const push = vi.fn();
      store.$router = { push };

      store.closeCurrentTag("/tasks");

      expect(push).toHaveBeenCalled();
    });
  });

  describe("enforceCacheLimit", () => {
    it("should remove oldest closable non-active tab when over limit", () => {
      store.cacheLimit = 3;

      for (let i = 0; i < 5; i++) {
        store.setTabsItem({ path: `/page-${i}`, name: `page-${i}` });
      }

      expect(store.tabs.length).toBeLessThanOrEqual(3);
    });

    it("should not remove active tab", () => {
      store.cacheLimit = 2;
      store.setTabsItem({ path: "/tasks", name: "tasks" });
      store.activePath = "/tasks";

      expect(store.tabs.find(t => t.path === "/tasks")).toBeDefined();
    });

    it("should not remove pinned tabs", () => {
      store.cacheLimit = 2;
      store.setTabsItem({ path: "/tasks", name: "tasks", pinned: true });
      store.setTabsItem({ path: "/reports", name: "reports" });

      store.enforceCacheLimit();

      expect(store.tabs.find(t => t.path === "/tasks")).toBeDefined();
    });
  });
});
