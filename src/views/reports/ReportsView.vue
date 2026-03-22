<script setup lang="ts">
import { computed } from "vue";
import { useTaskStore } from "@/store/modules/tasks";
import { useAnalyticsStore } from "@/store/modules/analytics";

const taskStore = useTaskStore();
const analyticsStore = useAnalyticsStore();

const grouped = computed(() => taskStore.groupedVisibleTasks);
const stats = computed(() => taskStore.stats);
const tagList = computed(() => taskStore.tagList);
const trend = computed(() => analyticsStore.trend);
</script>

<template>
  <section class="report-page">
    <header>
      <h2 class="page-title">Reports</h2>
      <p class="page-description">
        All metrics are derived from store getters and pure utility functions.
      </p>
    </header>

    <el-card shadow="never">
      <template #header>
        <div class="report-head">
          <span>Delivery Progress</span>
          <strong>{{ stats.progress }}%</strong>
        </div>
      </template>
      <el-progress :percentage="stats.progress" :stroke-width="16" />
    </el-card>

    <div class="status-grid">
      <el-card shadow="never">Todo: {{ grouped.todo.length }}</el-card>
      <el-card shadow="never">In Progress: {{ grouped.in_progress.length }}</el-card>
      <el-card shadow="never">Review: {{ grouped.review.length }}</el-card>
      <el-card shadow="never">Blocked: {{ grouped.blocked.length }}</el-card>
      <el-card shadow="never">Done: {{ grouped.done.length }}</el-card>
    </div>

    <el-card shadow="never">
      <template #header>Tag Activity</template>
      <div class="tag-list">
        <el-tag v-for="tag in tagList" :key="tag" effect="plain">{{ tag }}</el-tag>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>Progress Trend Snapshots</template>
      <p v-if="trend.length === 0">No trend data yet. Capture snapshots from Dashboard/Ops.</p>
      <el-table v-else :data="trend" size="small">
        <el-table-column prop="date" label="Date" width="120" />
        <el-table-column prop="progressRate" label="Progress %" width="120" />
        <el-table-column prop="blockedRate" label="Blocked %" width="120" />
      </el-table>
    </el-card>
  </section>
</template>

<style scoped>
.report-page {
  display: grid;
  gap: 0.9rem;
}

.report-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
</style>
