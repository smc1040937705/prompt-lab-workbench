<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { watch } from "vue";
import { useTabsStore } from "@/store/tabs";

const tabsStore = useTabsStore();
const { tabs, activePath } = storeToRefs(tabsStore);
const router = useRouter();
const route = useRoute();

watch(
  () => route.path,
  (path) => {
    tabsStore.bindRoute({ path }, { push: (nextPath: string) => router.push(nextPath) });
  },
  { immediate: true }
);

function onModelChange(name: string | number): void {
  router.push(String(name));
}

function onTabRemove(name: string | number): void {
  tabsStore.closeCurrentTag(String(name));
}

function closeOther(): void {
  tabsStore.closeTabsOther(route.path);
}

function clearAll(): void {
  tabsStore.clearTabs();
}
</script>

<template>
  <section class="tab-bar glass-card">
    <el-tabs
      :model-value="activePath"
      type="card"
      @update:model-value="onModelChange"
      @tab-remove="onTabRemove"
    >
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.path"
        :name="tab.path"
        :label="tab.title"
        :closable="tab.closable"
      />
    </el-tabs>
    <div class="tab-actions">
      <el-button size="small" text @click="closeOther">Close Others</el-button>
      <el-button size="small" text @click="clearAll">Keep Pinned</el-button>
    </div>
  </section>
</template>

<style scoped>
.tab-bar {
  margin-bottom: 0.8rem;
  padding: 0.55rem 0.75rem;
  display: flex;
  gap: 0.8rem;
  align-items: center;
}

.tab-bar :deep(.el-tabs) {
  flex: 1;
}

.tab-bar :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.tab-actions {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
</style>
