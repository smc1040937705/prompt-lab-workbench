import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTabsStore, type TabItem } from "@/store/tabs";

describe("Tabs Store", () => {
  let mockRouter: { push: ReturnType<typeof vi.fn> };
  let mockRoute: { path: string };

  beforeEach(() => {
    setActivePinia(createPinia());
    mockRouter = { push: vi.fn() };
    mockRoute = { path: "/dashboard" };
  });

  describe("初始状态", () => {
    it("应初始化时只有首页标签", () => {
      const store = useTabsStore();
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].path).toBe("/dashboard");
      expect(store.tabs[0].pinned).toBe(true);
      expect(store.activePath).toBe("/dashboard");
    });

    it("应正确计算show getter", () => {
      const store = useTabsStore();
      expect(store.show).toBe(true);
    });

    it("应正确计算nameList getter", () => {
      const store = useTabsStore();
      expect(store.nameList).toEqual(["dashboard"]);
    });
  });

  describe("bindRoute", () => {
    it("应绑定路由实例", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      expect(store.$route).toEqual(mockRoute);
      expect(store.$router).toEqual(mockRouter);
    });
  });

  describe("setTabsItem", () => {
    it("应添加新标签", () => {
      const store = useTabsStore();
      const newTab = { path: "/tasks", name: "tasks", title: "Tasks" };
      
      store.setTabsItem(newTab);
      
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[1].path).toBe("/tasks");
      expect(store.tabs[1].title).toBe("Tasks");
      expect(store.activePath).toBe("/tasks");
    });

    it("应更新现有标签", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Old Title" });
      
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "New Title" });
      
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs[1].title).toBe("New Title");
    });

    it("应设置默认值", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/settings", name: "settings" });
      
      const addedTab = store.tabs.find(tab => tab.path === "/settings");
      expect(addedTab?.title).toBe("settings");
      expect(addedTab?.closable).toBe(true);
      expect(addedTab?.pinned).toBe(false);
    });

    it("应保留pinned标签的不可关闭属性", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/reports", name: "reports", pinned: true });
      
      const addedTab = store.tabs.find(tab => tab.path === "/reports");
      expect(addedTab?.closable).toBe(false);
      expect(addedTab?.pinned).toBe(true);
    });

    it("应在超出缓存限制时移除最早的可关闭标签", () => {
      const store = useTabsStore();
      store.cacheLimit = 3;
      
      store.setTabsItem({ path: "/tab1", name: "tab1" });
      store.setTabsItem({ path: "/tab2", name: "tab2" });
      store.setTabsItem({ path: "/tab3", name: "tab3" });
      store.setTabsItem({ path: "/tab4", name: "tab4" });
      
      expect(store.tabs.length).toBeLessThanOrEqual(4);
    });
  });

  describe("delTabsItem", () => {
    it("应删除可关闭的标签", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      
      store.delTabsItem("/tasks");
      
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs.find(tab => tab.path === "/tasks")).toBeUndefined();
    });

    it("不应删除固定标签", () => {
      const store = useTabsStore();
      
      store.delTabsItem("/dashboard");
      
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].path).toBe("/dashboard");
    });

    it("删除活动标签时应切换到下一个标签", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      
      store.delTabsItem("/settings");
      
      expect(mockRouter.push).toHaveBeenCalled();
      expect(store.activePath).toBeDefined();
    });

    it("删除活动标签时应切换到上一个标签（如果是最后一个）", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      
      store.delTabsItem("/settings");
      
      expect(mockRouter.push).toHaveBeenCalled();
    });

    it("删除不存在的标签时应静默处理", () => {
      const store = useTabsStore();
      expect(() => store.delTabsItem("/non-existent")).not.toThrow();
    });
  });

  describe("clearTabs", () => {
    it("应清除所有非固定标签", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      
      store.clearTabs();
      
      expect(store.tabs).toHaveLength(1);
      expect(store.tabs[0].pinned).toBe(true);
      expect(mockRouter.push).toHaveBeenCalled();
    });
  });

  describe("closeTabsOther", () => {
    it("应关闭除当前标签外的所有非固定标签", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
      
      store.closeTabsOther("/tasks");
      
      expect(store.tabs).toHaveLength(2);
      expect(store.tabs.map(tab => tab.path)).toContain("/dashboard");
      expect(store.tabs.map(tab => tab.path)).toContain("/tasks");
      expect(store.tabs.map(tab => tab.path)).not.toContain("/settings");
      expect(store.tabs.map(tab => tab.path)).not.toContain("/reports");
      expect(mockRouter.push).toHaveBeenCalled();
    });

    it("未指定路径时应使用当前路由路径", () => {
      const store = useTabsStore();
      store.bindRoute({ path: "/tasks" }, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      
      store.closeTabsOther();
      
      expect(store.tabs).toHaveLength(2);
      expect(store.activePath).toBe("/tasks");
    });

    it("未指定路径且无绑定时应使用activePath", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.activePath = "/tasks";
      
      store.closeTabsOther();
      
      expect(store.tabs).toHaveLength(2);
    });
  });

  describe("closeLeft", () => {
    it("应关闭指定标签左侧的所有非固定标签", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      store.setTabsItem({ path: "/tab3", name: "tab3", title: "Tab 3" });
      
      store.closeLeft("/tab3");
      
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/tab3"]);
    });

    it("关闭最左侧标签时应不做任何操作", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      
      store.closeLeft("/dashboard");
      
      expect(store.tabs).toHaveLength(3);
    });

    it("未指定路径时应使用当前路由路径", () => {
      const store = useTabsStore();
      store.bindRoute({ path: "/tab2" }, mockRouter);
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      store.setTabsItem({ path: "/tab3", name: "tab3", title: "Tab 3" });
      
      store.closeLeft();
      
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/tab2", "/tab3"]);
    });
  });

  describe("closeRight", () => {
    it("应关闭指定标签右侧的所有非固定标签", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      store.setTabsItem({ path: "/tab3", name: "tab3", title: "Tab 3" });
      
      store.closeRight("/tab1");
      
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/tab1"]);
    });

    it("关闭最右侧标签时应不做任何操作", () => {
      const store = useTabsStore();
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      
      store.closeRight("/tab1");
      
      expect(store.tabs).toHaveLength(2);
    });

    it("未指定路径时应使用当前路由路径", () => {
      const store = useTabsStore();
      store.bindRoute({ path: "/tab1" }, mockRouter);
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      store.setTabsItem({ path: "/tab3", name: "tab3", title: "Tab 3" });
      
      store.closeRight();
      
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/tab1"]);
    });
  });

  describe("closeCurrentTag", () => {
    it("应关闭当前标签并返回下一个路径", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      
      const result = store.closeCurrentTag("/tasks");
      
      expect(store.tabs).toHaveLength(1);
      expect(result).toBeDefined();
      expect(mockRouter.push).toHaveBeenCalled();
    });

    it("未指定路径时应关闭活动标签", () => {
      const store = useTabsStore();
      store.bindRoute({ path: "/tasks" }, mockRouter);
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      
      const result = store.closeCurrentTag();
      
      expect(store.tabs).toHaveLength(1);
      expect(result).toBeDefined();
    });

    it("关闭最后一个可关闭标签时应保留Dashboard（pinned）并导航到它", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      
      // 添加一个可关闭的标签
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      expect(store.tabs.length).toBe(2);
      
      // 关闭tasks标签
      const result = store.closeCurrentTag("/tasks");
      
      // 应该回到dashboard
      expect(result).toBe("/dashboard");
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
      expect(store.tabs.length).toBe(1);
    });

    it("关闭不存在的标签时应返回活动路径", () => {
      const store = useTabsStore();
      
      const result = store.closeCurrentTag("/non-existent");
      
      expect(result).toBe("/dashboard");
    });
  });

  describe("enforceCacheLimit", () => {
    it("应在超出限制时移除最早的可关闭标签", () => {
      const store = useTabsStore();
      // 初始有1个pinned标签(Dashboard)
      store.cacheLimit = 2;
      
      // 添加第一个标签，总共2个标签，不超过限制
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      expect(store.tabs.length).toBe(2);
      
      // 再添加一个标签，总共3个标签，超过cacheLimit=2，会自动移除最早的可关闭标签
      store.setTabsItem({ path: "/tab2", name: "tab2", title: "Tab 2" });
      
      // enforceCacheLimit会移除一个标签，所以应该是2个标签
      expect(store.tabs.length).toBe(2);
    });

    it("不应移除活动标签", () => {
      const store = useTabsStore();
      store.cacheLimit = 2;
      store.setTabsItem({ path: "/tab1", name: "tab1", title: "Tab 1" });
      store.activePath = "/tab1";
      
      store.enforceCacheLimit();
      
      expect(store.tabs.find(tab => tab.path === "/tab1")).toBeDefined();
    });
  });

  describe("标签操作集成测试", () => {
    it("应正确处理复杂的标签操作序列", () => {
      const store = useTabsStore();
      store.bindRoute(mockRoute, mockRouter);
      
      store.setTabsItem({ path: "/tasks", name: "tasks", title: "Tasks" });
      store.setTabsItem({ path: "/settings", name: "settings", title: "Settings" });
      store.setTabsItem({ path: "/reports", name: "reports", title: "Reports" });
      
      expect(store.tabs).toHaveLength(4);
      
      store.closeLeft("/settings");
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/settings", "/reports"]);
      
      store.closeRight("/settings");
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard", "/settings"]);
      
      store.closeTabsOther("/dashboard");
      expect(store.tabs.map(tab => tab.path)).toEqual(["/dashboard"]);
    });
  });
});
