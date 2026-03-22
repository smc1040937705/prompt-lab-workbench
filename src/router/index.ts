import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import AppLayout from "@/layout/AppLayout.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/dashboard"
  },
  {
    path: "/",
    component: AppLayout,
    children: [
      {
        path: "dashboard",
        name: "dashboard",
        component: () => import("@/views/dashboard/DashboardView.vue"),
        meta: {
          title: "Dashboard",
          pinned: true
        }
      },
      {
        path: "tasks",
        name: "tasks",
        component: () => import("@/views/tasks/TaskBoardView.vue"),
        meta: {
          title: "Task Board"
        }
      },
      {
        path: "reports",
        name: "reports",
        component: () => import("@/views/reports/ReportsView.vue"),
        meta: {
          title: "Reports"
        }
      },
      {
        path: "ops",
        name: "ops",
        component: () => import("@/views/ops/OpsCenterView.vue"),
        meta: {
          title: "Operations"
        }
      },
      {
        path: "settings",
        name: "settings",
        component: () => import("@/views/settings/SettingsView.vue"),
        meta: {
          title: "Settings"
        }
      }
    ]
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/dashboard"
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.afterEach((to) => {
  const title = typeof to.meta.title === "string" ? to.meta.title : "Prompt Lab";
  document.title = `${title} - Prompt Lab`;
});

export default router;
