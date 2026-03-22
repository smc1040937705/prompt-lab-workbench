import type { UserPermission } from "@/types/user";

export interface AppNavItem {
  path: string;
  name: string;
  title: string;
  icon?: string;
  pinned?: boolean;
  requiredPermission?: UserPermission;
}

export const APP_NAVIGATION: AppNavItem[] = [
  {
    path: "/dashboard",
    name: "dashboard",
    title: "Dashboard",
    icon: "DataBoard",
    pinned: true
  },
  {
    path: "/tasks",
    name: "tasks",
    title: "Task Board",
    icon: "Grid"
  },
  {
    path: "/reports",
    name: "reports",
    title: "Reports",
    icon: "TrendCharts",
    requiredPermission: "report:view"
  },
  {
    path: "/ops",
    name: "ops",
    title: "Operations",
    icon: "Setting",
    requiredPermission: "ops:sync"
  },
  {
    path: "/settings",
    name: "settings",
    title: "Settings",
    icon: "Tools",
    requiredPermission: "settings:edit"
  }
];
