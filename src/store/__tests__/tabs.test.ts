import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useTabsStore } from "@/store/tabs";

describe("useTabsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("state initialization", () => {
    it("should initialize with home tab", () => {
      const store = useTabsStore();

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].path).toBe("/dashboard");
      expect(store.tabs[0].pinned).toBe(true);
      expect(store.tabs[0].closable).toBe(false);
      expect(store.activePath).toBe("/dashboard");
    });

    it("should have correct cache limit", () => {
      const store = useTabsStore();
      expect(store.cacheLimit).toBe(12);
    });
  });

  describe("getters", () => {
    it("should return show as true when tabs exist", () => {
      const store = useTabsStore();
      expect(store.show).toBe(true);
    });

    it("should return name list", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      expect(store.nameList).toContain("dashboard");
      expect(store.nameList).toContain("tasks");
    });
  });

  describe("setTabsItem", () => {
    it("should add new tab", () => {
      const store = useTabsStore();

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[1].path).toBe("/tasks");
      expect(store.activePath).toBe("/tasks");
    });

    it("should update existing tab", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Updated Tasks" });

      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[1].title).toBe("Updated Tasks");
    });

    it("should set active path", () => {
      const store = useTabsStore();

      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });

      expect(store.activePath).toBe("/settings");
    });

    it("should apply default closable based on pinned", () => {
      const store = useTabsStore();

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks", pinned: true });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });

      expect(store.tabs[1].closable).toBe(false);
      expect(store.tabs[2].closable).toBe(true);
    });

    it("should enforce cache limit", () => {
      const store = useTabsStore();
      store.cacheLimit = 3;

      store.setTabsItem({ path: "/a", name: "a", title: "A" });
      store.setTabsItem({ path: "/b", name: "b", title: "B" });
      store.setTabsItem({ path: "/c", name: "c", title: "C" });

      expect(store.tabs.length).toBeLessThanOrEqual(3);
    });
  });

  describe("delTabsItem", () => {
    it("should remove closable tab", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });

      store.delTabsItem("/tasks");

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs.find((t) => t.path === "/tasks")).toBeUndefined();
    });

    it("should not remove pinned tab", () => {
      const store = useTabsStore();

      store.delTabsItem("/dashboard");

      expect(store.tabs).toHaveLength(1);
    });

    it("should not remove non-closable tab", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks", closable: false });

      store.delTabsItem("/tasks");

      expect(store.tabs).toHaveLength(2);
    });

    it("should switch to next tab when removing active", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.activePath = "/tasks";

      store.delTabsItem("/tasks");

      expect(store.activePath).toBe("/settings");
      expect(push).toHaveBeenCalledWith("/settings");
    });

    it("should switch to previous tab when removing last", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.activePath = "/settings";

      store.delTabsItem("/settings");

      expect(store.activePath).toBe("/tasks");
      expect(push).toHaveBeenCalledWith("/tasks");
    });
  });

  describe("clearTabs", () => {
    it("should remove all non-pinned tabs", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });

      store.clearTabs();

      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].path).toBe("/dashboard");
    });

    it("should navigate to first pinned tab", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.activePath = "/tasks";

      store.clearTabs();

      expect(store.activePath).toBe("/dashboard");
      expect(push).toHaveBeenCalledWith("/dashboard");
    });
  });

  describe("closeTabsOther", () => {
    it("should keep only current and pinned tabs", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });

      store.closeTabsOther("/tasks");

      expect(store.tabs).toHaveLength(2);
      expect(store.tabs.map((t) => t.path)).toContain("/dashboard");
      expect(store.tabs.map((t) => t.path)).toContain("/tasks");
    });

    it("should use current route when no path provided", () => {
      const store = useTabsStore();
      store.$route = { path: "/tasks" };
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });

      store.closeTabsOther();

      expect(store.tabs.map((t) => t.path)).toContain("/tasks");
    });
  });

  describe("closeLeft", () => {
    it("should remove tabs to the left of target", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/a", name: "a", title: "A" });
      store.setTabsItem({ path: "/b", name: "b", title: "B" });
      store.setTabsItem({ path: "/c", name: "c", title: "C" });

      store.closeLeft("/b");

      expect(store.tabs.map((t) => t.path)).toEqual(["/dashboard", "/b", "/c"]);
    });

    it("should keep pinned tabs", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/a", name: "a", title: "A", pinned: true });
      store.setTabsItem({ path: "/b", name: "b", title: "B" });

      store.closeLeft("/b");

      expect(store.tabs.map((t) => t.path)).toEqual(["/dashboard", "/a", "/b"]);
    });

    it("should do nothing when target is first", () => {
      const store = useTabsStore();
      const originalTabs = [...store.tabs];

      store.closeLeft("/dashboard");

      expect(store.tabs).toEqual(originalTabs);
    });
  });

  describe("closeRight", () => {
    it("should remove tabs to the right of target", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/a", name: "a", title: "A" });
      store.setTabsItem({ path: "/b", name: "b", title: "B" });
      store.setTabsItem({ path: "/c", name: "c", title: "C" });

      store.closeRight("/b");

      expect(store.tabs.map((t) => t.path)).toEqual(["/dashboard", "/a", "/b"]);
    });

    it("should keep pinned tabs", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/a", name: "a", title: "A" });
      store.setTabsItem({ path: "/b", name: "b", title: "B", pinned: true });
      store.setTabsItem({ path: "/c", name: "c", title: "C" });

      store.closeRight("/a");

      expect(store.tabs.map((t) => t.path)).toEqual(["/dashboard", "/a", "/b"]);
    });
  });

  describe("closeCurrentTag", () => {
    it("should close current tab and return next path", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.activePath = "/tasks";

      const nextPath = store.closeCurrentTag("/tasks");

      expect(nextPath).toBe("/settings");
      expect(store.tabs.find((t) => t.path === "/tasks")).toBeUndefined();
    });

    it("should not close pinned tab", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      const nextPath = store.closeCurrentTag("/dashboard");

      expect(nextPath).toBe("/dashboard");
      expect(store.tabs).toHaveLength(1);
    });

    it("should handle last closable tab closure", () => {
      const store = useTabsStore();
      const push = vi.fn();
      store.$router = { push };

      // Initial state has 1 pinned tab (dashboard)
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.activePath = "/tasks";
      expect(store.tabs).toHaveLength(2);

      const nextPath = store.closeCurrentTag("/tasks");

      // After closing the only closable tab, should navigate to first pinned tab
      expect(nextPath).toBe("/dashboard");
      expect(store.tabs).toHaveLength(1); // Only pinned dashboard remains
      expect(push).toHaveBeenCalledWith("/dashboard");
    });

    it("should use $route path when not provided", () => {
      const store = useTabsStore();
      store.$route = { path: "/tasks" };
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });

      store.closeCurrentTag();

      expect(store.tabs.find((t) => t.path === "/tasks")).toBeUndefined();
    });
  });

  describe("enforceCacheLimit", () => {
    it("should remove oldest non-active closable tab when limit exceeded", () => {
      const store = useTabsStore();
      store.cacheLimit = 3;

      store.setTabsItem({ path: "/a", name: "a", title: "A" });
      store.setTabsItem({ path: "/b", name: "b", title: "B" });
      store.setTabsItem({ path: "/c", name: "c", title: "C" });

      expect(store.tabs.length).toBeLessThanOrEqual(3);
    });
  });
});
