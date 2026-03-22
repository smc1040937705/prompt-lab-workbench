import { defineStore } from "pinia";

export interface TabItem {
  path: string;
  name: string;
  title: string;
  closable: boolean;
  pinned: boolean;
}

type RouterLike = {
  push: (path: string) => unknown;
};

type RouteLike = {
  path: string;
};

const HOME_TAB: TabItem = {
  path: "/dashboard",
  name: "dashboard",
  title: "Dashboard",
  closable: false,
  pinned: true
};

function ensureTabDefaults(tab: Partial<TabItem> & Pick<TabItem, "path" | "name">): TabItem {
  const pinned = Boolean(tab.pinned);
  return {
    path: tab.path,
    name: tab.name,
    title: tab.title ?? tab.name,
    closable: tab.closable ?? !pinned,
    pinned
  };
}

export const useTabsStore = defineStore("tabs", {
  state: () => ({
    tabs: [HOME_TAB] as TabItem[],
    activePath: HOME_TAB.path,
    cacheLimit: 12,
    $route: null as RouteLike | null,
    $router: null as RouterLike | null
  }),
  getters: {
    show: (state) => state.tabs.length > 0,
    nameList: (state) => state.tabs.map((tab) => tab.name)
  },
  actions: {
    bindRoute(route: RouteLike, router: RouterLike): void {
      this.$route = route;
      this.$router = router;
    },

    setTabsItem(input: Partial<TabItem> & Pick<TabItem, "path" | "name">): void {
      const nextTab = ensureTabDefaults(input);
      const index = this.tabs.findIndex((tab) => tab.path === nextTab.path);

      if (index === -1) {
        this.tabs.push(nextTab);
      } else {
        this.tabs[index] = { ...this.tabs[index], ...nextTab };
      }

      this.activePath = nextTab.path;
      this.enforceCacheLimit();
    },

    delTabsItem(path: string): void {
      const index = this.tabs.findIndex((tab) => tab.path === path);
      if (index < 0) {
        return;
      }

      const target = this.tabs[index];
      if (target.pinned || !target.closable) {
        return;
      }

      this.tabs.splice(index, 1);
      if (this.activePath === path) {
        const next = this.tabs[index] ?? this.tabs[index - 1];
        this.activePath = next?.path ?? "/";
        this.$router?.push(this.activePath);
      }
    },

    clearTabs(): void {
      this.tabs = this.tabs.filter((tab) => tab.pinned);
      this.activePath = this.tabs[0]?.path ?? "/";
      this.$router?.push(this.activePath);
    },

    closeTabsOther(currentPath?: string): void {
      const targetPath = currentPath ?? this.$route?.path ?? this.activePath;
      const targetTab = this.tabs.find((tab) => tab.path === targetPath);

      this.tabs = this.tabs.filter((tab) => tab.pinned || tab.path === targetPath);
      this.activePath = targetTab?.path ?? this.tabs[0]?.path ?? "/";
      this.$router?.push(this.activePath);
    },

    closeLeft(currentPath?: string): void {
      const targetPath = currentPath ?? this.$route?.path ?? this.activePath;
      const index = this.tabs.findIndex((tab) => tab.path === targetPath);
      if (index <= 0) {
        return;
      }
      this.tabs = this.tabs.filter((tab, tabIndex) => tab.pinned || tabIndex >= index);
    },

    closeRight(currentPath?: string): void {
      const targetPath = currentPath ?? this.$route?.path ?? this.activePath;
      const index = this.tabs.findIndex((tab) => tab.path === targetPath);
      if (index < 0) {
        return;
      }
      this.tabs = this.tabs.filter((tab, tabIndex) => tab.pinned || tabIndex <= index);
    },

    closeCurrentTag(path?: string): string {
      const currentPath = path ?? this.$route?.path ?? this.activePath;
      const index = this.tabs.findIndex((tab) => tab.path === currentPath);

      if (index < 0) {
        return this.activePath;
      }

      const currentTab = this.tabs[index];
      if (currentTab.pinned || !currentTab.closable) {
        this.activePath = currentTab.path;
        this.$router?.push(this.activePath);
        return this.activePath;
      }

      if (this.tabs.length === 1) {
        this.tabs = [];
        this.activePath = "/";
        this.$router?.push("/");
        return "/";
      }

      const nextPath =
        index < this.tabs.length - 1 ? this.tabs[index + 1].path : this.tabs[index - 1].path;

      this.tabs.splice(index, 1);
      this.activePath = nextPath;
      this.$router?.push(nextPath);
      return nextPath;
    },

    enforceCacheLimit(): void {
      if (this.tabs.length <= this.cacheLimit) {
        return;
      }

      const removable = this.tabs.findIndex(
        (tab) => tab.path !== this.activePath && tab.closable && !tab.pinned
      );
      if (removable >= 0) {
        this.tabs.splice(removable, 1);
      }
    }
  }
});
