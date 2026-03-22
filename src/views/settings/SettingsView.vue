<script setup lang="ts">
import { usePreferencesStore } from "@/store/modules/preferences";
import { useTaskStore } from "@/store/modules/tasks";
import { useUserStore } from "@/store/modules/user";

const preferences = usePreferencesStore();
const taskStore = useTaskStore();
const userStore = useUserStore();

function reset(): void {
  preferences.resetPreferences();
}

function onThemeChange(mode: string | number | boolean): void {
  if (mode === "light" || mode === "dark") {
    preferences.setThemeMode(mode);
  }
}

function onVelocityChange(value: number | string | undefined): void {
  taskStore.setWeeklyVelocity(Number(value));
}

function onDueSoonChange(value: string | number | boolean): void {
  preferences.updateNotifications({ taskDueSoon: Boolean(value) });
}

function onBlockedChange(value: string | number | boolean): void {
  preferences.updateNotifications({ taskBlocked: Boolean(value) });
}

function onDigestChange(value: string | number | boolean): void {
  preferences.updateNotifications({ weeklyDigest: Boolean(value) });
}
</script>

<template>
  <section class="settings-page">
    <header>
      <h2 class="page-title">Settings</h2>
      <p class="page-description">Theme, notifications, session, and planning velocity.</p>
    </header>

    <el-card shadow="never">
      <template #header>Visual Preferences</template>
      <el-form label-width="140px">
        <el-form-item label="Theme mode">
          <el-radio-group
            :model-value="preferences.themeMode"
            @change="onThemeChange"
          >
            <el-radio label="light">Light</el-radio>
            <el-radio label="dark">Dark</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Primary color">
          <el-color-picker
            :model-value="preferences.primaryColor"
            @change="preferences.setPrimaryColor"
          />
        </el-form-item>

        <el-form-item label="Page size">
          <el-slider
            :model-value="preferences.pageSize"
            :min="5"
            :max="50"
            :step="1"
            show-input
            @change="preferences.setPageSize"
          />
        </el-form-item>

        <el-form-item label="Compact mode">
          <el-switch
            :model-value="preferences.compactMode"
            @change="preferences.setCompactMode"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>Task Planning</template>
      <el-form label-width="140px">
        <el-form-item label="Weekly velocity">
          <el-input-number
            :model-value="taskStore.weeklyVelocityHours"
            :min="0"
            :max="200"
            @change="onVelocityChange"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>Session & Notifications</template>
      <el-form label-width="140px">
        <el-form-item label="Current user">
          <span>{{ userStore.displayName }} ({{ userStore.role }})</span>
        </el-form-item>
        <el-form-item label="Session status">
          <el-tag :type="userStore.isExpired ? 'danger' : 'success'">
            {{ userStore.isExpired ? "Expired" : "Active" }}
          </el-tag>
        </el-form-item>
        <el-form-item label="Due soon notification">
          <el-switch
            :model-value="preferences.notifications.taskDueSoon"
            @change="onDueSoonChange"
          />
        </el-form-item>
        <el-form-item label="Blocked notification">
          <el-switch
            :model-value="preferences.notifications.taskBlocked"
            @change="onBlockedChange"
          />
        </el-form-item>
        <el-form-item label="Weekly digest">
          <el-switch
            :model-value="preferences.notifications.weeklyDigest"
            @change="onDigestChange"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-space>
      <el-button @click="reset">Reset Preferences</el-button>
      <el-button @click="userStore.refreshSession(120)">Extend Session 120m</el-button>
      <el-button type="danger" plain @click="userStore.logout">Logout</el-button>
    </el-space>
  </section>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 0.9rem;
}
</style>
