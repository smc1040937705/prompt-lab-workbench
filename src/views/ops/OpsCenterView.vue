<script setup lang="ts">
import { computed } from "vue";
import { useTaskStore } from "@/store/modules/tasks";
import { useAnalyticsStore } from "@/store/modules/analytics";
import { useUserStore } from "@/store/modules/user";
import type { UserRole } from "@/types/workflow";
import { localRulesSyncer } from "@/services/task-sync";

const taskStore = useTaskStore();
const analyticsStore = useAnalyticsStore();
const userStore = useUserStore();

const roleOptions: UserRole[] = ["owner", "manager", "member", "viewer"];

const canSync = computed(() => userStore.can("ops:sync"));
const sla = computed(() => taskStore.slaSnapshot);
const issues = computed(() => taskStore.dependencyIssues);
const forecast = computed(() => taskStore.deliveryForecast);
const latestSnapshot = computed(() => analyticsStore.latestSnapshot);

async function handleSync(): Promise<void> {
  await taskStore.syncTasks(localRulesSyncer);
}

function captureSnapshot(): void {
  analyticsStore.captureSnapshot();
}

function switchRole(role: string | number | boolean): void {
  const next = String(role) as UserRole;
  if (roleOptions.includes(next)) {
    userStore.switchRole(next);
  }
}
</script>

<template>
  <section class="ops-page">
    <header class="ops-header">
      <div>
        <h2 class="page-title">Operations Center</h2>
        <p class="page-description">
          Operational controls, workflow quality checks, and delivery diagnostics.
        </p>
      </div>
      <el-space>
        <el-button @click="captureSnapshot">Capture Snapshot</el-button>
        <el-button type="primary" :disabled="!canSync" @click="handleSync">
          Sync Tasks
        </el-button>
      </el-space>
    </header>

    <el-card shadow="never">
      <template #header>Session Role</template>
      <el-radio-group :model-value="userStore.role" @change="switchRole">
        <el-radio-button v-for="role in roleOptions" :key="role" :label="role">
          {{ role }}
        </el-radio-button>
      </el-radio-group>
    </el-card>

    <div class="ops-grid">
      <el-card shadow="never">
        <template #header>SLA Snapshot</template>
        <ul class="metric-list">
          <li>Healthy: {{ sla.healthy }}</li>
          <li>Warning: {{ sla.warning }}</li>
          <li>Danger: {{ sla.danger }}</li>
        </ul>
      </el-card>

      <el-card shadow="never">
        <template #header>Dependency Integrity</template>
        <ul class="metric-list">
          <li>Missing deps: {{ issues.missing.length }}</li>
          <li>Circular chains: {{ issues.circular.length }}</li>
          <li>Top risk tasks: {{ taskStore.topRiskTasks.length }}</li>
        </ul>
      </el-card>

      <el-card shadow="never">
        <template #header>Delivery Forecast</template>
        <ul class="metric-list">
          <li>Remaining hours: {{ forecast.remainingHours }}</li>
          <li>Weeks needed: {{ forecast.weeksNeeded ?? "N/A" }}</li>
          <li>ETA: {{ forecast.etaDate ?? "N/A" }}</li>
        </ul>
      </el-card>
    </div>

    <el-alert
      v-if="taskStore.syncState === 'failed'"
      type="error"
      show-icon
      :closable="false"
      :title="`Sync failed: ${taskStore.syncError}`"
    />
    <el-alert
      v-else-if="taskStore.syncState === 'success'"
      type="success"
      show-icon
      :closable="false"
      title="Task sync succeeded."
    />

    <el-card shadow="never">
      <template #header>Latest Analytics Snapshot</template>
      <p v-if="!latestSnapshot">No snapshot captured yet.</p>
      <ul v-else class="metric-list">
        <li>Date: {{ latestSnapshot.date }}</li>
        <li>Active: {{ latestSnapshot.activeCount }}</li>
        <li>Done: {{ latestSnapshot.doneCount }}</li>
        <li>Blocked: {{ latestSnapshot.blockedCount }}</li>
        <li>Average risk: {{ latestSnapshot.averageRisk }}</li>
        <li>Top assignee: {{ latestSnapshot.topAssignee ?? "N/A" }}</li>
      </ul>
    </el-card>
  </section>
</template>

<style scoped>
.ops-page {
  display: grid;
  gap: 0.9rem;
}

.ops-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.ops-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
}

.metric-list {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.92rem;
}

@media (max-width: 760px) {
  .ops-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
