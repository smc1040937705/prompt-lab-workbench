<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import TaskSummary from "@/components/TaskSummary.vue";
import { useTaskStore } from "@/store/modules/tasks";
import { useAnalyticsStore } from "@/store/modules/analytics";
import { useUserStore } from "@/store/modules/user";

const taskStore = useTaskStore();
const analyticsStore = useAnalyticsStore();
const userStore = useUserStore();

const stats = computed(() => taskStore.stats);
const nextTask = computed(() => taskStore.nextTask);
const latestSnapshot = computed(() => analyticsStore.latestSnapshot);

function capture(): void {
  const snapshot = analyticsStore.captureSnapshot();
  ElMessage.success(`Snapshot captured for ${snapshot.date}`);
}
</script>

<template>
  <section class="dashboard-page">
    <header class="hero-row">
      <div>
        <h2 class="page-title">Team Dashboard</h2>
        <p class="page-description">
          Live workload and workflow signals for {{ userStore.displayName }}.
        </p>
      </div>
      <el-button @click="capture">Capture Snapshot</el-button>
    </header>

    <div class="summary-grid">
      <TaskSummary title="Active Tasks" :value="stats.total" highlight />
      <TaskSummary title="Done" :value="stats.done" />
      <TaskSummary title="Review" :value="stats.review" />
      <TaskSummary title="Blocked" :value="stats.blocked" />
      <TaskSummary title="Overdue" :value="stats.overdue" />
      <TaskSummary title="Archived" :value="stats.archived" />
    </div>

    <el-card v-if="nextTask" class="next-card" shadow="never">
      <template #header>
        <span>Next highest-impact task</span>
      </template>
      <h3 class="next-title">{{ nextTask.title }}</h3>
      <p class="next-description">{{ nextTask.description }}</p>
      <div class="next-meta">
        <el-tag effect="light" type="danger">{{ nextTask.priority }}</el-tag>
        <el-tag effect="plain">{{ nextTask.assignee }}</el-tag>
        <span>Due {{ nextTask.dueDate }}</span>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>Latest analytics snapshot</template>
      <p v-if="!latestSnapshot">No snapshot yet.</p>
      <div v-else class="snapshot-meta">
        <span>Date: {{ latestSnapshot.date }}</span>
        <span>Avg risk: {{ latestSnapshot.averageRisk }}</span>
        <span>Top assignee: {{ latestSnapshot.topAssignee ?? "N/A" }}</span>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: grid;
  gap: 1rem;
}

.hero-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.summary-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

.next-card {
  border-radius: 12px;
  border: 1px solid var(--surface-border);
}

.next-title {
  margin: 0;
  font-size: 1.1rem;
}

.next-description {
  margin: 0.5rem 0;
  color: var(--text-secondary);
}

.next-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.55rem;
  font-size: 0.9rem;
}

.snapshot-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: var(--text-secondary);
}
</style>
