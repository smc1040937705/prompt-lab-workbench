<script setup lang="ts">
import * as ElementPlusIcons from "@element-plus/icons-vue";
import type { Component } from "vue";
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TabBar from "@/components/TabBar.vue";
import { APP_NAVIGATION } from "@/constants/navigation";
import { useTabsStore } from "@/store/tabs";
import { useUserStore } from "@/store/modules/user";

const router = useRouter();
const route = useRoute();
const tabsStore = useTabsStore();
const userStore = useUserStore();

userStore.hydrateSession();
if (!userStore.isLoggedIn) {
  userStore.loginAsDefault();
}

const activePath = computed(() => route.path);

const availableNavigation = computed(() =>
  APP_NAVIGATION.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }
    return userStore.can(item.requiredPermission);
  })
);

watch(
  () => route.path,
  (path) => {
    const nav = APP_NAVIGATION.find((item) => item.path === path);
    const name = typeof route.name === "string" ? route.name : path;
    tabsStore.setTabsItem({
      path,
      name,
      title: nav?.title ?? String(route.meta.title ?? name),
      pinned: Boolean(nav?.pinned),
      closable: !nav?.pinned
    });
    tabsStore.bindRoute({ path }, { push: (nextPath: string) => router.push(nextPath) });
  },
  { immediate: true }
);

function onSelect(path: string): void {
  router.push(path);
}

function resolveIcon(name?: string): Component | undefined {
  if (!name) {
    return undefined;
  }
  return (ElementPlusIcons as Record<string, Component>)[name];
}
</script>

<template>
  <el-container class="layout-shell">
    <el-aside class="layout-aside glass-card">
      <h1 class="brand-title">Prompt Lab</h1>
      <div class="identity-card">
        <p class="identity-name">{{ userStore.displayName }}</p>
        <p class="identity-role">Role: {{ userStore.role }}</p>
      </div>
      <el-menu
        :default-active="activePath"
        class="menu-panel"
        @select="onSelect"
      >
        <el-menu-item
          v-for="item in availableNavigation"
          :key="item.path"
          :index="item.path"
        >
          <el-icon v-if="resolveIcon(item.icon)">
            <component :is="resolveIcon(item.icon)" />
          </el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="layout-main">
      <TabBar />
      <section class="view-panel glass-card">
        <router-view />
      </section>
    </el-main>
  </el-container>
</template>

<style scoped>
.layout-shell {
  min-height: 100vh;
  padding: 1rem;
  gap: 1rem;
}

.layout-aside {
  width: 224px;
  padding: 0.9rem;
}

.brand-title {
  margin: 0 0 0.9rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.identity-card {
  background: var(--brand-primary-soft);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.85rem;
}

.identity-name {
  margin: 0;
  font-weight: 600;
}

.identity-role {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.menu-panel {
  border-right: 0;
  background: transparent;
}

.menu-panel :deep(.el-menu-item) {
  border-radius: 10px;
  margin-bottom: 0.3rem;
}

.menu-panel :deep(.is-active) {
  background: var(--brand-primary-soft);
  color: var(--brand-primary);
  font-weight: 600;
}

.layout-main {
  padding: 0;
}

.view-panel {
  min-height: calc(100vh - 98px);
  padding: 1rem;
}

@media (max-width: 960px) {
  .layout-shell {
    display: block;
  }

  .layout-aside {
    width: 100%;
    margin-bottom: 0.8rem;
  }
}
</style>
