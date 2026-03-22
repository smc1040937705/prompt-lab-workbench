import { defineStore } from "pinia";
import { mix } from "@/utils";

export type ThemeMode = "light" | "dark";

interface NotificationPolicy {
  taskDueSoon: boolean;
  taskBlocked: boolean;
  weeklyDigest: boolean;
}

const STORAGE_KEY = "prompt_lab_preferences";

interface PreferencesState {
  themeMode: ThemeMode;
  primaryColor: string;
  compactMode: boolean;
  pageSize: number;
  notifications: NotificationPolicy;
}

function getDefaultState(): PreferencesState {
  return {
    themeMode: "light",
    primaryColor: "#1f8a70",
    compactMode: false,
    pageSize: 8,
    notifications: {
      taskDueSoon: true,
      taskBlocked: true,
      weeklyDigest: false
    }
  };
}

function safeParse(raw: string | null): Partial<PreferencesState> {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Partial<PreferencesState>;
  } catch {
    return {};
  }
}

export const usePreferencesStore = defineStore("preferences", {
  state: (): PreferencesState => ({
    ...getDefaultState(),
    ...safeParse(localStorage.getItem(STORAGE_KEY))
  }),
  getters: {
    isDark(state): boolean {
      return state.themeMode === "dark";
    },
    secondaryColor(state): string {
      return mix(state.primaryColor, "#ffffff", 65);
    }
  },
  actions: {
    setThemeMode(mode: ThemeMode): void {
      this.themeMode = mode;
      this.persist();
    },
    setPrimaryColor(color: string): void {
      this.primaryColor = color;
      this.persist();
    },
    setCompactMode(compact: boolean): void {
      this.compactMode = compact;
      this.persist();
    },
    setPageSize(size: number): void {
      this.pageSize = Math.min(Math.max(size, 5), 50);
      this.persist();
    },
    updateNotifications(patch: Partial<NotificationPolicy>): void {
      this.notifications = { ...this.notifications, ...patch };
      this.persist();
    },
    resetPreferences(): void {
      Object.assign(this, getDefaultState());
      this.persist();
    },
    persist(): void {
      const payload: PreferencesState = {
        themeMode: this.themeMode,
        primaryColor: this.primaryColor,
        compactMode: this.compactMode,
        pageSize: this.pageSize,
        notifications: this.notifications
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  }
});
